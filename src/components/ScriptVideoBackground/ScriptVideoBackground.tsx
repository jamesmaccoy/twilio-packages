'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { useScroll, useTransform, motion } from 'framer-motion';
import { script } from './data';
import { Scene } from './Scene';
import type { Post, Media } from '@/payload-types';

const SCENE_DURATION_PER_TEXT = 4000; // ms per text block

interface ScriptVideoBackgroundProps {
    featuredPosts?: Post[];
    /** 1-based indices of scenes to show. Omit to show all scenes. */
    sceneIndices?: number[];
}

export const ScriptVideoBackground: React.FC<ScriptVideoBackgroundProps> = ({ featuredPosts = [], sceneIndices }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    });

    // Merge static script with dynamic featured posts
    const activeScript = useMemo(() => {
        return script.map(scene => {
            if (scene.id === 'scene-choice') {
                // Create options from featured posts
                const postOptions = featuredPosts.slice(0, 3).map(post => {
                    const media = post.meta?.image || post.heroImage;
                    const imageUrl = (media && typeof media === 'object' && 'url' in media && media.url)
                        ? media.url
                        : '';

                    return {
                        id: `post-${post.id}`,
                        type: 'post' as const,
                        label: post.title,
                        src: imageUrl,
                        slug: post.slug || ''
                    };
                });

                // Get the existing ticket option if present
                const existingOptions = scene.options || [];
                const ticketOption = existingOptions.find(o => o.type === 'ticket');

                return {
                    ...scene,
                    options: [
                        ...postOptions,
                        ...(ticketOption ? [ticketOption] : [])
                    ]
                };
            }
            return scene;
        });
    }, [featuredPosts]);

    // Filter to specific scenes if requested (1-based indices)
    const filteredScript = useMemo(() => {
        if (!sceneIndices || sceneIndices.length === 0) return activeScript;
        return sceneIndices.map(i => activeScript[i - 1]).filter((s): s is typeof activeScript[number] => s !== undefined);
    }, [activeScript, sceneIndices]);

    const totalScenes = filteredScript.length;

    // Transform scroll progress to scene index
    // We want to snap or blend? For now, straight mapping.
    // 0 to 1 -> 0 to totalScenes - 1
    const currentSceneIndex = useTransform(scrollYProgress, [0, 1], [0, totalScenes - 1]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [activeTextIndex, setActiveTextIndex] = useState(0);

    useEffect(() => {
        const unsubscribe = currentSceneIndex.on("change", (latest) => {
            const index = Math.min(Math.floor(latest), totalScenes - 1);
            setActiveIndex(index);

            // Calculate text index within the scene
            const sceneProgress = (latest - index); // 0 to 1 within the scene
            const currentScene = filteredScript[index];
            if (currentScene && currentScene.texts.length > 0) {
                const textIdx = Math.min(
                    Math.floor(sceneProgress * currentScene.texts.length * 1.5),
                    currentScene.texts.length - 1
                );
                setActiveTextIndex(textIdx);
            } else {
                setActiveTextIndex(0);
            }
        });
        return () => unsubscribe();
    }, [currentSceneIndex, totalScenes, filteredScript]);

    return (
        <div ref={containerRef} className="relative w-full" style={{ height: `${totalScenes * 100}vh` }}>
            <div className="sticky top-0 left-0 w-full h-[100dvh] bg-black overflow-hidden">
                <div className="absolute top-4 right-4 z-50 mix-blend-difference text-white/50 font-mono text-sm">
                    {activeIndex + 1} / {totalScenes}
                </div>

                {filteredScript.map((scene, index) => (
                    <Scene
                        key={`${scene.id}-${index}`}
                        scene={scene}
                        isActive={index === activeIndex}
                        activeTextIndex={index === activeIndex ? activeTextIndex : 0}
                        currentSceneIndex={currentSceneIndex}
                        index={index}
                    />
                ))}

                {/* Progress Bar */}
                <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10 z-50">
                    <motion.div
                        className="h-full bg-white"
                        style={{ scaleX: scrollYProgress, transformOrigin: "0%" }}
                    />
                </div>
            </div>
        </div>
    );
};
