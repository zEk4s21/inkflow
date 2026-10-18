"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";

/** Imagen de portfolio con fallback digno si el archivo falta o no carga. */
export function WorkImage({
  src,
  alt,
  width,
  height,
  sizes,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${alt} (imagen no disponible)`}
        className={cn("flex aspect-[4/5] items-center justify-center bg-surface-2 text-xs text-fg-subtle", className)}
      >
        Imagen no disponible
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(true)}
      className={cn("aspect-[4/5] object-cover", className)}
    />
  );
}
