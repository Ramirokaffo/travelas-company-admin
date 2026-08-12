"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";

type ImageCropperProps = {
  open: boolean;
  /** Image d'origine choisie par l'utilisateur ; `null` quand la fenêtre est fermée. */
  file: File | null;
  /** Rapport largeur/hauteur imposé : `1` pour un carré, `2` pour une bannière. */
  aspect: number;
  /** Largeur maximale, en pixels, de l'image produite. */
  maxWidth?: number;
  /** Poids maximal, en octets, au-delà duquel un PNG est réencodé plus petit. */
  maxBytes?: number;
  /**
   * Autorise le WebP en sortie. À laisser à `false` pour les routes qui ne
   * l'acceptent pas — `POST /auth/profile/image` valide les types avec
   * `/^image\/(jpeg|jpg|ico|png)$/i`, là où les images d'entreprise passent par
   * un validateur plus large. Un WebP y reviendrait en 400 après un
   * téléversement complet, sans que l'utilisateur puisse rien y faire.
   */
  allowWebp?: boolean;
  title: string;
  onCancel: () => void;
  onCropped: (file: File) => void;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
/** Pas du zoom au clavier et aux deux boutons. */
const ZOOM_STEP = 0.2;
/** Déplacement, en pixels du cadre, à chaque appui sur une flèche. */
const PAN_STEP = 12;

/**
 * Le backend n'accepte que ces types (`MyFileTypeValidator`). PNG et WebP
 * conservent la couche alpha — ce qui compte pour un logo posé sur un fond de
 * couleur ; tout le reste, icônes comprises, ressort en JPEG.
 */
const OUTPUT_TYPES: Record<string, { type: string; extension: string }> = {
  "image/png": { type: "image/png", extension: "png" },
  "image/webp": { type: "image/webp", extension: "webp" },
};
const DEFAULT_OUTPUT = { type: "image/jpeg", extension: "jpg" };
const JPEG_QUALITY = 0.92;
/** Repli d'un PNG trop lourd : le WebP compresse en gardant la couche alpha. */
const WEBP_OUTPUT = { type: "image/webp", extension: "webp" };
const WEBP_QUALITY = 0.9;

type Source = { url: string; width: number; height: number };
type Offset = { x: number; y: number };
/** `offset: null` = cadrage centré, valeur par défaut tant qu'on n'a pas déplacé. */
type View = { zoom: number; offset: Offset | null };

const INITIAL_VIEW: View = { zoom: MIN_ZOOM, offset: null };

/**
 * Fenêtre de recadrage à rapport imposé.
 *
 * Le cadre ne se redimensionne pas : c'est l'image qui se déplace et se zoome
 * derrière lui. Le rapport 1:1 ou 2:1 est donc une propriété de l'outil et non
 * une contrainte que l'utilisateur devrait maintenir à la souris — il ne peut
 * pas en sortir, et ce qu'il voit dans le cadre est exactement le fichier qui
 * partira.
 *
 * Le découpage a lieu dans un `<canvas>` : l'image postée est déjà au bon
 * rapport et bornée en largeur, le backend ne reçoit jamais l'original de
 * 12 Mpx.
 */
export function ImageCropper({
  open,
  file,
  aspect,
  maxWidth = 1600,
  maxBytes = 2 * 1024 * 1024,
  allowWebp = true,
  title,
  onCancel,
  onCropped,
}: ImageCropperProps) {
  const t = useTranslations("common.cropper");
  const tCommon = useTranslations("common");

  const frameRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    start: Offset;
  } | null>(null);

  // Le fichier est porté par l'état à côté de son décodage : c'est ce qui
  // permet d'ignorer le résultat d'un chargement devenu obsolète sans avoir à
  // remettre l'état à zéro depuis un effet.
  const [loaded, setLoaded] = useState<{ file: File; source: Source | null } | null>(
    null,
  );
  const [frameWidth, setFrameWidth] = useState(0);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [isProcessing, setIsProcessing] = useState(false);

  const source = loaded && loaded.file === file ? loaded.source : null;
  const failed = Boolean(loaded && loaded.file === file && !loaded.source);
  const frameHeight = frameWidth / aspect;

  // Décodage de l'image. `URL.createObjectURL` est autorisé par la CSP
  // (`img-src blob:`) et l'URL est révoquée dès que le fichier change : sans
  // cela, chaque essai laisserait une image en mémoire.
  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () =>
      setLoaded({
        file,
        source: { url, width: image.naturalWidth, height: image.naturalHeight },
      });
    image.onerror = () => setLoaded({ file, source: null });
    image.src = url;

    return () => URL.revokeObjectURL(url);
  }, [file]);

  // La largeur du cadre dépend de la fenêtre modale, donc de l'écran : toute la
  // géométrie s'exprime en pixels de ce cadre, il faut donc la mesurer. Le
  // `ResizeObserver` est posé par la ref de rappel plutôt que par un effet, ce
  // qui donne la première mesure dès l'attachement du nœud.
  const attachFrame = useCallback((node: HTMLDivElement | null) => {
    frameRef.current = node;
    if (!node) return;

    // Fermée, la `<dialog>` est en `display: none` : la mesure vaut alors 0 et
    // c'est l'observateur qui la corrigera à l'ouverture.
    setFrameWidth(node.clientWidth);
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => setFrameWidth(node.clientWidth));
    observer.observe(node);
    return () => {
      observer.disconnect();
      frameRef.current = null;
    };
  }, []);

  // Nouvelle image ou cadre redimensionné : le cadrage précédent, exprimé en
  // pixels du cadre, n'a plus de sens. Remise à zéro pendant le rendu — le
  // motif recommandé par React, qui évite le rendu intermédiaire d'un effet.
  const layout = `${source?.url ?? ""}@${frameWidth}`;
  const [lastLayout, setLastLayout] = useState(layout);
  if (lastLayout !== layout) {
    setLastLayout(layout);
    setView(INITIAL_VIEW);
  }

  const scale =
    source && frameWidth ? coverScale(source, frameWidth, frameHeight) * view.zoom : 1;
  const drawnWidth = source ? source.width * scale : 0;
  const drawnHeight = source ? source.height * scale : 0;
  const offset = view.offset ?? {
    x: (frameWidth - drawnWidth) / 2,
    y: (frameHeight - drawnHeight) / 2,
  };

  const clamp = useCallback(
    (next: Offset, forZoom: number): Offset => {
      if (!source || !frameWidth) return next;
      const zoomedScale = coverScale(source, frameWidth, frameHeight) * forZoom;
      return {
        x: clampAxis(next.x, frameWidth, source.width * zoomedScale),
        y: clampAxis(next.y, frameHeight, source.height * zoomedScale),
      };
    },
    [source, frameWidth, frameHeight],
  );

  const zoomTo = useCallback(
    (nextZoom: number) => {
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
      const ratio = zoom / view.zoom;
      setView({
        zoom,
        // Zoom centré sur le milieu du cadre : sans ce report, l'image dérive
        // vers son coin supérieur gauche à chaque cran.
        offset: clamp(
          {
            x: frameWidth / 2 - (frameWidth / 2 - offset.x) * ratio,
            y: frameHeight / 2 - (frameHeight / 2 - offset.y) * ratio,
          },
          zoom,
        ),
      });
    },
    [clamp, frameWidth, frameHeight, offset.x, offset.y, view.zoom],
  );

  // `onWheel` de React est passif : `preventDefault()` y serait sans effet et
  // la page défilerait sous la fenêtre. D'où l'écouteur natif explicite.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !open || !source) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomTo(view.zoom - event.deltaY * 0.002);
    };

    frame.addEventListener("wheel", handleWheel, { passive: false });
    return () => frame.removeEventListener("wheel", handleWheel);
  }, [open, source, zoomTo, view.zoom]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!source) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      start: offset,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    setView((current) => ({
      ...current,
      offset: clamp(
        {
          x: drag.start.x + (event.clientX - drag.x),
          y: drag.start.y + (event.clientY - drag.y),
        },
        current.zoom,
      ),
    }));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!source) return;

    const pan = (x: number, y: number) => {
      event.preventDefault();
      setView((current) => ({
        ...current,
        offset: clamp({ x: offset.x + x, y: offset.y + y }, current.zoom),
      }));
    };

    switch (event.key) {
      case "ArrowLeft":
        return pan(PAN_STEP, 0);
      case "ArrowRight":
        return pan(-PAN_STEP, 0);
      case "ArrowUp":
        return pan(0, PAN_STEP);
      case "ArrowDown":
        return pan(0, -PAN_STEP);
      case "+":
      case "=":
        event.preventDefault();
        return zoomTo(view.zoom + ZOOM_STEP);
      case "-":
        event.preventDefault();
        return zoomTo(view.zoom - ZOOM_STEP);
      default:
        return;
    }
  };

  const handleApply = async () => {
    const image = imageRef.current;
    if (!image || !source || !file || !frameWidth) return;

    setIsProcessing(true);
    try {
      const cropped = await cropToFile({
        image,
        file,
        source,
        offset,
        scale,
        frame: { width: frameWidth, height: frameHeight },
        aspect,
        maxWidth,
        maxBytes,
        allowWebp,
      });

      if (cropped) onCropped(cropped);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={t("instructions")}
      dismissible={!isProcessing}
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isProcessing}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={!source || isProcessing}
          >
            {isProcessing ? t("processing") : t("apply")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          ref={attachFrame}
          role="group"
          aria-label={t("frameLabel")}
          tabIndex={source ? 0 : -1}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
          style={{
            aspectRatio: String(aspect),
            maxWidth: aspect < 1.5 ? "20rem" : undefined,
          }}
          className={cn(
            "bg-subtle relative mx-auto w-full touch-none overflow-hidden rounded-xl",
            "focus-visible:ring-brand-500 outline-none focus-visible:ring-2",
            source ? "cursor-grab active:cursor-grabbing" : "cursor-default",
          )}
        >
          {source ? (
            // Image locale et éphémère : `next/image` n'y apporterait rien, il
            // ne sait pas optimiser un `blob:`.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imageRef}
              src={source.url}
              alt=""
              draggable={false}
              style={{
                width: drawnWidth,
                height: drawnHeight,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
              }}
              className="max-w-none origin-top-left select-none"
            />
          ) : (
            <p className="text-muted absolute inset-0 flex items-center justify-center px-4 text-center text-sm">
              {failed ? t("failed") : t("loading")}
            </p>
          )}
        </div>

        <div className="mx-auto flex max-w-sm items-center gap-3">
          <button
            type="button"
            onClick={() => zoomTo(view.zoom - ZOOM_STEP)}
            disabled={!source || view.zoom <= MIN_ZOOM}
            aria-label={t("zoomOut")}
            className="text-muted hover:text-foreground rounded-lg p-1 transition-colors disabled:opacity-40"
          >
            <Minus className="size-4" aria-hidden />
          </button>

          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={view.zoom}
            disabled={!source}
            aria-label={t("zoom")}
            onChange={(event) => zoomTo(Number(event.target.value))}
            className="accent-brand-500 h-1 w-full cursor-pointer"
          />

          <button
            type="button"
            onClick={() => zoomTo(view.zoom + ZOOM_STEP)}
            disabled={!source || view.zoom >= MAX_ZOOM}
            aria-label={t("zoomIn")}
            className="text-muted hover:text-foreground rounded-lg p-1 transition-colors disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden />
          </button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setView(INITIAL_VIEW)}
            disabled={!source}
          >
            {t("recenter")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Échelle minimale pour que l'image couvre le cadre sans laisser de vide. */
function coverScale(source: Source, frameWidth: number, frameHeight: number): number {
  return Math.max(frameWidth / source.width, frameHeight / source.height);
}

/**
 * Borne un décalage : l'image couvrant toujours le cadre, la position utile va
 * de `frame - drawn` (bord droit ou bas collé) à `0` (bord gauche ou haut).
 */
function clampAxis(value: number, frame: number, drawn: number): number {
  if (drawn <= frame) return (frame - drawn) / 2;
  return Math.min(0, Math.max(frame - drawn, value));
}

type CropInput = {
  image: HTMLImageElement;
  file: File;
  source: Source;
  offset: Offset;
  scale: number;
  frame: { width: number; height: number };
  aspect: number;
  maxWidth: number;
  maxBytes: number;
  allowWebp: boolean;
};

/**
 * Découpe la portion visible dans le cadre et la réencode.
 *
 * La sortie est plafonnée à `maxWidth` : un capteur de téléphone produit des
 * images de plusieurs mégaoctets, bien au-delà des 2 Mo acceptés par le
 * backend, alors qu'un logo n'a besoin que de quelques centaines de pixels.
 */
async function cropToFile({
  image,
  file,
  source,
  offset,
  scale,
  frame,
  aspect,
  maxWidth,
  maxBytes,
  allowWebp,
}: CropInput): Promise<File | null> {
  // Passage des pixels du cadre à ceux de l'image d'origine.
  const sourceWidth = Math.min(frame.width / scale, source.width);
  const sourceHeight = Math.min(frame.height / scale, source.height);
  const sourceX = Math.min(Math.max(-offset.x / scale, 0), source.width - sourceWidth);
  const sourceY = Math.min(
    Math.max(-offset.y / scale, 0),
    source.height - sourceHeight,
  );

  const width = Math.max(1, Math.round(Math.min(sourceWidth, maxWidth)));
  const height = Math.max(1, Math.round(width / aspect));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return null;

  let output = OUTPUT_TYPES[file.type] ?? DEFAULT_OUTPUT;
  // Route qui refuse le WebP : un WebP d'entrée ressort en JPEG. La couche
  // alpha est perdue, mais c'est le seul format que la destination accepte.
  if (!allowWebp && output.type === "image/webp") output = DEFAULT_OUTPUT;

  // Le JPEG ignore la couche alpha : sans ce fond, une image transparente
  // ressortirait sur du noir.
  if (output.type === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }

  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );

  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  let blob = await encode(output.type, JPEG_QUALITY);
  if (!blob) return null;

  // Le PNG est sans perte : une photo recadrée en 1600 px de large en ressort
  // à plusieurs mégaoctets, au-delà de ce que le backend accepte — et
  // l'utilisateur n'aurait aucun moyen de corriger ça depuis l'interface. Le
  // WebP le ramène à quelques centaines de kilo-octets sans perdre l'alpha,
  // qui est la seule raison d'avoir choisi le PNG. Là où le WebP est refusé, le
  // repli est le JPEG : l'alpha y disparaît, mais un fichier trop lourd serait
  // refusé de toute façon.
  if (output.type === "image/png" && blob.size > maxBytes) {
    const fallback = allowWebp ? WEBP_OUTPUT : DEFAULT_OUTPUT;
    const smaller = await encode(
      fallback.type,
      allowWebp ? WEBP_QUALITY : JPEG_QUALITY,
    );
    if (smaller && smaller.size < blob.size) {
      blob = smaller;
      output = fallback;
    }
  }

  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.${output.extension}`, { type: output.type });
}
