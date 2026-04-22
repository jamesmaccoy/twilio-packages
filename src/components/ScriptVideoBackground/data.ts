
export interface ChoiceOption {
    id: string;
    type: 'post' | 'ticket';
    label: string;
    src?: string; // Image source
    slug?: string; // For posts
    action?: string; // For ticket
}

export interface SceneData {
    id: string;
    type: 'image' | 'sprite' | 'video' | 'choice';
    src: string;
    texts: string[];
    overlay?: string;
    options?: ChoiceOption[];
    // For sprite cropping (percentages)
    crop?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    // Custom animation override
    animation?: {
        initial: { scale: number; x: string | number; y: string | number };
        animate: { scale: number; x: string | number; y: string | number };
        transition: { duration: number; ease: "linear" | "easeIn" | "easeOut" | "easeInOut" | "circIn" | "circOut" | "circInOut" | "backIn" | "backOut" | "backInOut" | "anticipate" };
    };
}

const ASSET_PREFIX = '/ad-movie';

export const script: SceneData[] = [
    {
        id: 'scene-intro-1',
        type: 'video',
        src: `${ASSET_PREFIX}/video1.mp4`,
        texts: [
            "Experience the vibe\nin motion."
        ]
    },
    {
        id: 'scene-intro-2',
        type: 'video',
        src: `${ASSET_PREFIX}/video2.mp4`,
        texts: [
            "Keep reservation\n with a membership"
        ]
    },
    {
        id: 'scene-1',
        type: 'image',
        src: `${ASSET_PREFIX}/2.png`,
        animation: {
            initial: { scale: 1.0, x: '0%', y: '0%' },
            animate: { scale: 1.15, x: '-5%', y: '0%' },
            transition: { duration: 15, ease: "linear" }
        },
        texts: [
            "I always set\nthe alarm off, and\ncan never remember\nthe pin code.",
            "Closing the door to arm\nis super standard."
        ]
    },
    {
        id: 'scene-2',
        type: 'image',
        src: `${ASSET_PREFIX}/Gallery_Gathering.png`,
        texts: [
            "No Electricity or water,\nno problem.",
            "Just order a Hike, and you have a response to a solution.",
            "10l water backup in\nthe utility."
        ]
    },
    {
        id: 'scene-3',
        type: 'image',
        src: `${ASSET_PREFIX}/Img_2023_10_12_18_07_19~2 (1).png`,
        texts: [
            "Film studio\ncreative licence\nby the hour.",
            "Parking for surf\n Event space \nshort term bookings"
        ]
    },
    {
        id: 'scene-book',
        type: 'image',
        src: `${ASSET_PREFIX}/guest_book.png`,
        texts: [
            "Review a record\npayment and notes\non every guest"
        ]
    },
    {
        id: 'scene-4',
        type: 'image',
        src: `${ASSET_PREFIX}/ocean.jpg`,
        texts: [
            "The South Easter\nis blowing.\nLogically I wouldn't start\nbraaing, and of course\nI would leave an open\nflame while I went to\nthe beach, duh."
        ]
    },
    {
        id: 'scene-5',
        type: 'image',
        src: `${ASSET_PREFIX}/studio_ticket.png`,
        texts: [
            "Security is pretty\ntight, but don't carry any\ncash."
        ]
    },
    {
        id: 'scene-cassette',
        type: 'image',
        src: `${ASSET_PREFIX}/cassette.png`,
        texts: [
            "Rewind to the\ngood times."
        ]
    },
    {
        id: 'scene-choice',
        type: 'choice',
        src: '', // Background for choice scene, can be black or a blurred previous image
        texts: [
            "Choose your vibe."
        ],
        options: [
            // These will be populated mainly by the parent component passing featured posts
            {
                id: 'opt-ticket',
                type: 'ticket',
                label: 'Studio Ticket',
                src: `${ASSET_PREFIX}/studio_ticket.png`,
                action: 'open-ticket'
            }
        ]
    },
    {
        id: 'scene-7',
        type: 'video',
        src: `${ASSET_PREFIX}/video1.mp4`,
        texts: [],
        overlay: `${ASSET_PREFIX}/studio_ticket.png`
    },
    {
        id: 'scene-8',
        type: 'video',
        src: `${ASSET_PREFIX}/video2.mp4`,
        texts: [],
        overlay: `${ASSET_PREFIX}/studio_ticket.png`
    }
];
