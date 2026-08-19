import { useState, type CSSProperties } from "react";

export type PolaroidPhotoProps = {
  src: string;
  alt?: string;
  position?: string;
  rotation?: number;
  size?: "small" | "medium" | "large";
  loading?: "eager" | "lazy";
  className?: string;
  style?: CSSProperties;
};

export function PolaroidPhoto({
  src,
  alt = "",
  position = "center center",
  rotation = 0,
  size = "medium",
  loading = "lazy",
  className = "",
  style,
}: PolaroidPhotoProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (failed) return null;

  return (
    <figure
      aria-hidden={alt ? undefined : true}
      className={[
        "polaroid-photo",
        `polaroid-photo--${size}`,
        !loaded && !failed ? "polaroid-photo--loading" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        { ...style, "--polaroid-rotation": `${rotation}deg` } as CSSProperties
      }
    >
      <div className="polaroid-photo__image-area">
        <img
          alt={alt}
          decoding="async"
          height="300"
          loading={loading}
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          src={src}
          style={{ objectPosition: position }}
          width="400"
        />
      </div>
    </figure>
  );
}
