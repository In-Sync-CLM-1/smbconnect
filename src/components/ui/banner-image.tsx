import { cn } from '@/lib/utils';

interface BannerImageProps {
  src: string;
  alt?: string;
  /** Extra classes for the wrapper (defaults to filling its positioned parent). */
  className?: string;
}

/**
 * Renders a banner / cover image in full, never cropped, regardless of its
 * aspect ratio. The image itself uses object-contain so its entire content
 * (text, logos, faces) stays visible; a blurred, zoomed copy sits behind it to
 * fill any leftover space, so very wide or oddly-shaped banners look
 * intentional instead of letterboxed.
 *
 * Drop it inside a positioned, fixed-height container (the banner strip). Any
 * overlay controls (edit buttons, etc.) should be rendered as later siblings so
 * they stack above the image.
 */
export function BannerImage({ src, alt = 'Cover', className }: BannerImageProps) {
  return (
    <div className={cn('absolute inset-0 h-full w-full overflow-hidden bg-muted', className)}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl"
      />
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  );
}
