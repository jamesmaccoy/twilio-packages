# Scroll-Driven Animation System

A luxury scroll-driven animation system with fixed sections and mask reveals, inspired by high-end editorial design.

## Overview

This system provides sophisticated scroll-based animations with:
- **Fixed sections** that stick to the viewport while scrolling
- **Mask reveals** with multiple animation types (circle, wipe, inset)
- **Parallax effects** for depth and movement
- **Smooth spring physics** for luxurious feel

## Components

### `ScrollSection`
A container component that creates a scroll-driven animation section. The `height` prop determines how long the animation lasts (e.g., "250vh" means the section takes 2.5 viewport heights to scroll through).

```tsx
<ScrollSection height="250vh">
  {(progress) => {
    // progress is a MotionValue<number> from 0 to 1
    // Use it to drive animations
    return <YourContent />
  }}
</ScrollSection>
```

### `ImageReveal`
Reveals images with various mask animations:
- `center-circle`: Expands from center
- `wipe-up`: Reveals from bottom to top
- `wipe-right`: Reveals from left to right
- `inset`: Reveals from edges inward

```tsx
<ImageReveal
  image={mediaObject}
  alt="Description"
  progress={progress}
  type="center-circle"
  range={[0, 0.6]} // Animation happens between 0% and 60% of scroll
  className="w-full h-full"
/>
```

### `ParallaxLayer`
Creates parallax movement effects. Use negative `speed` for upward movement, positive for downward.

```tsx
<ParallaxLayer progress={progress} speed={-0.2}>
  <YourContent />
</ParallaxLayer>
```

## Usage

### Demo Page
Visit `/scroll-animation` to see a complete example with four distinct sections:
1. Hero with circular mask reveal
2. Split layout with opposing parallax motion
3. Full-bleed horizontal wipe
4. Staggered grid composition

### Integration Example

```tsx
import { ScrollSection } from '@/components/ScrollSection'
import { ImageReveal } from '@/components/ImageReveal'
import { ParallaxLayer } from '@/components/ParallaxLayer'
import { useTransform } from 'framer-motion'

export function MyPage() {
  return (
    <ScrollSection height="200vh">
      {(progress) => {
        const opacity = useTransform(progress, [0, 0.5], [0, 1])
        return (
          <motion.div style={{ opacity }}>
            <ImageReveal
              image={myImage}
              alt="My Image"
              progress={progress}
              type="wipe-up"
              range={[0, 0.8]}
            />
          </motion.div>
        )
      }}
    </ScrollSection>
  )
}
```

## Animation Techniques

### Progress Mapping
The `range` prop on `ImageReveal` allows you to control when animations occur:
- `range={[0, 1]}` - Animation happens throughout entire scroll
- `range={[0.2, 0.8]}` - Animation happens between 20% and 80% of scroll
- `range={[0.5, 1]}` - Animation happens in second half of scroll

### Combining Animations
You can combine multiple animations for complex effects:

```tsx
<ScrollSection height="300vh">
  {(progress) => {
    const imageOpacity = useTransform(progress, [0, 0.3], [0, 1])
    const textY = useTransform(progress, [0.3, 0.6], [50, 0])
    
    return (
      <>
        <motion.div style={{ opacity: imageOpacity }}>
          <ImageReveal ... />
        </motion.div>
        <motion.div style={{ y: textY }}>
          <Text />
        </motion.div>
      </>
    )
  }}
</ScrollSection>
```

## Styling

The system uses your existing design tokens:
- `font-serif-display` (Playfair Display) for headings
- `font-serif-text` (Cormorant Garamond) for body text
- Color scheme: `#faf9f7` (background), `#0a0a0a` (text), `secondary` (accent)

## Performance

- Uses Framer Motion's `useScroll` with optimized scroll tracking
- Spring physics for smooth, natural-feeling animations
- GPU-accelerated transforms (clipPath, scale, translate)
- Images are lazy-loaded by default

## Browser Support

Requires modern browsers with support for:
- CSS `clip-path`
- `IntersectionObserver` API
- CSS transforms

## Files Created

- `/src/hooks/useScrollProgress.ts` - Scroll progress hook with spring physics
- `/src/components/ScrollSection.tsx` - Container component
- `/src/components/ImageReveal.tsx` - Image reveal animations
- `/src/components/ParallaxLayer.tsx` - Parallax effects
- `/src/components/ScrollAnimationPage.tsx` - Complete demo page component
- `/src/app/(frontend)/scroll-animation/page.tsx` - Demo route

