import React from 'react';

/** Full-bleed skeleton for the 16:9 hero image area. */
export function SkeletonHero() {
  return (
    <div className="absolute inset-0 skeleton-shimmer" />
  );
}

/** Sidebar history row skeleton (thumbnail + two text lines). */
export function SkeletonSidebarItem() {
  return (
    <div className="flex gap-3">
      <div className="w-32 aspect-video rounded-lg shrink-0 skeleton-shimmer" />
      <div className="flex-1 flex flex-col justify-center gap-2 py-1">
        <div className="h-2.5 rounded skeleton-shimmer w-full" />
        <div className="h-2.5 rounded skeleton-shimmer w-2/3" />
        <div className="h-2 rounded skeleton-shimmer w-1/3 mt-1" />
      </div>
    </div>
  );
}

/** Mobile grid card skeleton (aspect-video thumbnail + two text lines). */
export function SkeletonGridItem() {
  return (
    <div>
      <div className="aspect-video rounded-xl skeleton-shimmer" />
      <div className="mt-2 space-y-1.5">
        <div className="h-3 rounded skeleton-shimmer w-full" />
        <div className="h-3 rounded skeleton-shimmer w-3/4" />
      </div>
    </div>
  );
}

/** Heading-sized skeleton block for the scene title area. */
export function SkeletonTitle() {
  return (
    <div className="space-y-3 mb-3">
      <div className="h-9 rounded skeleton-shimmer w-3/4" />
      <div className="h-9 rounded skeleton-shimmer w-1/2" />
    </div>
  );
}

/** Italic paragraph skeleton for the scene tone / poem area. */
export function SkeletonTone() {
  return (
    <div className="space-y-2 mb-5">
      <div className="h-3.5 rounded skeleton-shimmer w-full max-w-[60ch]" />
      <div className="h-3.5 rounded skeleton-shimmer w-[80%] max-w-[50ch]" />
      <div className="h-3.5 rounded skeleton-shimmer w-[60%] max-w-[40ch]" />
    </div>
  );
}
