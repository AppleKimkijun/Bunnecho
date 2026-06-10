function decodeImage(image: HTMLImageElement) {
  if (typeof image.decode === "function") {
    return image.decode().catch(() => undefined);
  }
  return Promise.resolve();
}

export function preloadImages(urls: readonly string[]): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))];

  if (unique.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(
    unique.map(
      (url) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.onload = () => {
            void decodeImage(image).finally(() => resolve());
          };
          image.onerror = () => resolve();
          image.src = url;
        }),
    ),
  ).then(() => undefined);
}
