interface PostImageGridProps {
  images: string[];
  className?: string;
}

/**
 * Read-only photo grid for a post. Handles legacy single-photo posts and
 * new multi-photo posts with the same LinkedIn-style layout (1 / 2 / 3 / 4+).
 */
export function PostImageGrid({ images, className = '' }: PostImageGridProps) {
  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <div className={`overflow-hidden rounded-lg bg-black/5 ${className}`}>
        <img
          src={images[0]}
          alt="Post"
          className="w-full object-contain"
          style={{ maxHeight: '516px' }}
        />
      </div>
    );
  }

  if (images.length === 2) {
    return (
      <div className={`grid grid-cols-2 gap-1 overflow-hidden rounded-lg ${className}`}>
        {images.map((url, i) => (
          <img key={i} src={url} alt={`Post ${i + 1}`} className="w-full h-64 object-cover bg-black/5" />
        ))}
      </div>
    );
  }

  if (images.length === 3) {
    return (
      <div className={`grid grid-cols-2 gap-1 overflow-hidden rounded-lg ${className}`}>
        <img src={images[0]} alt="Post 1" className="w-full h-full object-cover bg-black/5 row-span-2" style={{ maxHeight: '516px' }} />
        <img src={images[1]} alt="Post 2" className="w-full h-32 object-cover bg-black/5" />
        <img src={images[2]} alt="Post 3" className="w-full h-32 object-cover bg-black/5" />
      </div>
    );
  }

  const extraCount = images.length - 4;
  return (
    <div className={`grid grid-cols-2 gap-1 overflow-hidden rounded-lg ${className}`}>
      {images.slice(0, 4).map((url, i) => (
        <div key={i} className="relative">
          <img src={url} alt={`Post ${i + 1}`} className="w-full h-32 object-cover bg-black/5" />
          {i === 3 && extraCount > 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-lg font-semibold">+{extraCount}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Merges legacy image_url with the new image_urls array for display components. */
export function resolvePostImages(post: { image_url?: string | null; image_urls?: string[] | null }): string[] {
  if (post.image_urls && post.image_urls.length > 0) return post.image_urls;
  return post.image_url ? [post.image_url] : [];
}
