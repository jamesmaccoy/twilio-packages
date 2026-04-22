
import { motion, AnimatePresence, MotionValue, useTransform } from 'framer-motion';
import Link from 'next/link';
import type { SceneData } from './data';

interface SceneProps {
    scene: SceneData;
    isActive: boolean;
    activeTextIndex: number;
    currentSceneIndex?: MotionValue<number>;
    index?: number;
}

export const Scene: React.FC<SceneProps> = ({ scene, isActive, activeTextIndex, currentSceneIndex, index = 0 }) => {
    // Styles for sprite cropping
    const imageStyle: React.CSSProperties = scene.type === 'sprite' && scene.crop ? {
        objectFit: 'cover' as const,
        objectPosition: `${(scene.crop.x / (100 - scene.crop.width)) * 100}% ${(scene.crop.y / (100 - scene.crop.height)) * 100}%`,
        width: '100%',
        height: '100%',
        transform: 'scale(1.2)' // Slight zoom to compensate for potential borders in sprite
    } : {
        objectFit: 'cover' as const,
        width: '100%',
        height: '100%',
    };

    // Vertical scroll animation for specific scenes
    // We default to 0 if no motion value is provided
    const defaultMotionValue = new MotionValue(0);

    const safeSceneIndex = currentSceneIndex || defaultMotionValue;

    // Animate from 100% (bottom) to -100% (top) as we scroll through the scene [index, index+1]
    const yTransform = useTransform(
        safeSceneIndex,
        [index, index + 1],
        ['50%', '-50%']
    );

    // Layout Formation Animation for Choice Scene
    const isChoiceScene = scene.type === 'choice';

    // We want the formation to complete by the time we are 20-30% into the scene
    // So the user sees them assemble and then has time to click
    const formationProgress = useTransform(
        safeSceneIndex,
        [index, index + 0.6],
        [0, 1]
    );

    // Helper to create individual item transforms based on index
    const getItemTransform = (itemIndex: number) => {
        // Random-ish start positions based on item index
        const startX = itemIndex % 2 === 0 ? '-100%' : '100%';
        const startY = itemIndex < 2 ? '-100%' : '100%';
        const startRotate = (itemIndex % 2 === 0 ? -15 : 15) * (itemIndex < 2 ? 1 : -1);
        const startScale = 0.5;

        const x = useTransform(formationProgress, [0, 1], [startX, '0%']);
        const y = useTransform(formationProgress, [0, 1], [startY, '0%']);
        const rotate = useTransform(formationProgress, [0, 1], [startRotate, 0]);
        const scale = useTransform(formationProgress, [0, 1], [startScale, 1]);
        const opacity = useTransform(formationProgress, [0, 0.2], [0, 1]); // Fade in quickly

        return { x, y, rotate, scale, opacity };
    };

    const isVerticalScrollScene = scene.id === 'scene-book' || scene.id === 'scene-cassette';

    return (
        <div className={`absolute inset-0 w-full h-full overflow-hidden bg-black transition-opacity duration-1000 ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>

            {/* Background Image with slight Ken Burns effect or Vertical Scroll */}
            {scene.type !== 'choice' && (
                <motion.div
                    className="absolute inset-0 w-full h-full"
                    initial={scene.animation?.initial || { scale: 1 }}
                    animate={
                        isVerticalScrollScene
                            ? { scale: 1 } // Handled via style transform for y
                            : (isActive ? (scene.animation?.animate || { scale: 1.05 }) : (scene.animation?.initial || { scale: 1 }))
                    }
                    style={isVerticalScrollScene ? { y: yTransform, scale: 0.8 } : undefined}
                    transition={scene.animation?.transition || { duration: 10, ease: "linear" }}
                >
                    {scene.type === 'sprite' ? (
                        <div className="w-full h-full overflow-hidden relative">
                            {/* We use a much larger image and position it absolutely to "crop" it */}
                            <img
                                src={scene.src}
                                alt=""
                                className="absolute max-w-none"
                                style={{
                                    top: `-${scene.crop?.y}%`,
                                    left: `-${scene.crop?.x}%`,
                                    width: '400%', // Since it's a 4x2 grid roughly (based on 25% width), 400% width makes one cell 100% of container
                                    height: '200%', // 2 rows -> 200% height
                                    objectFit: 'cover'
                                }}
                            />
                        </div>
                    ) : scene.type === 'video' ? (
                        <video
                            src={scene.src}
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <img src={scene.src} alt="" style={isVerticalScrollScene ? { ...imageStyle, objectFit: 'contain' } : imageStyle} />
                    )}
                </motion.div>
            )}

            {/* Choice Scene UI */}
            {scene.type === 'choice' && (
                <div className="absolute inset-0 w-full h-full bg-black/90 flex flex-col items-center justify-center p-4">
                    <h2 className="text-3xl md:text-5xl font-bold font-sans text-white mb-8 md:mb-12 text-center drop-shadow-lg">
                        {scene.texts[0]}
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-6xl">
                        {scene.options?.map((option, idx) => {
                            const transforms = getItemTransform(idx);
                            return (
                                <motion.div
                                    key={option.id + idx}
                                    style={{
                                        x: transforms.x,
                                        y: transforms.y,
                                        rotate: transforms.rotate,
                                        scale: transforms.scale,
                                        opacity: transforms.opacity
                                    }}
                                    className="relative aspect-[3/4]"
                                >
                                    <Link
                                        href={option.type === 'post' ? `/posts/${option.slug}` : (option.action === 'open-ticket' ? '#' : '#')}
                                        className="block w-full h-full group relative overflow-hidden rounded-lg bg-white/5 border border-white/10 hover:border-white/50 transition-all duration-300"
                                    >
                                        {option.src && (
                                            <img
                                                src={option.src}
                                                alt={option.label}
                                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-60 group-hover:opacity-100"
                                            />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                        <div className="absolute bottom-0 left-0 w-full p-4">
                                            <span className="text-sm font-mono text-white/70 uppercase tracking-wider mb-1 block">
                                                {option.type === 'post' ? 'Featured' : 'Access'}
                                            </span>
                                            <h3 className="text-xl md:text-2xl font-bold text-white leading-tight font-sans">
                                                {option.label}
                                            </h3>
                                        </div>
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}


            {/* Dark Gradient Overlay for non-choice scenes */}
            {scene.type !== 'choice' && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            )}

            {/* Overlay Image */}
            {scene.overlay && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <img
                        src={scene.overlay}
                        alt="overlay"
                        className="w-1/2 h-auto object-contain drop-shadow-2xl opacity-90"
                        style={{ transform: 'rotate(-5deg)' }}
                    />
                </div>
            )}

            {/* Text Overlay for non-choice scenes */}
            {scene.type !== 'choice' && (
                <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-16 pb-24 z-30">
                    <AnimatePresence mode="wait">
                        {scene.texts[activeTextIndex] && (
                            <motion.div
                                key={`${scene.id}-text-${activeTextIndex}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.5 }}
                                className="max-w-2xl"
                            >
                                <h2 className="text-3xl md:text-5xl font-bold font-sans text-white leading-tight drop-shadow-lg whitespace-pre-line">
                                    {scene.texts[activeTextIndex]}
                                </h2>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};
