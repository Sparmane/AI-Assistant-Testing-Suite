import React, { useState } from 'react';
import { BotIcon, UserGroupIcon, ChartBarIcon, BriefcaseIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons';

interface LandingPageProps {
  onNavigate: (suiteId: string) => void;
}

const suites = [
    {
        id: 'ragbot',
        title: 'RAGbot QA Suite',
        description: 'Evaluate generated answers for bias, safety, and relevance based on your knowledge base.',
        icon: <BotIcon className="w-16 h-16 text-indigo-400" />,
        cta: 'Launch Suite',
        active: true,
    },
    {
        id: 'persona',
        title: 'Persona Testing Suite',
        description: 'Test your model\'s responses against various user personas to ensure consistency and appropriateness.',
        icon: <UserGroupIcon className="w-16 h-16 text-indigo-400" />,
        cta: 'Launch Suite',
        active: true,
    },
    {
        id: 'sellsheet',
        title: 'Sell Sheet Testing Suite',
        description: 'Analyze marketing and sales copy for effectiveness, clarity, and brand voice alignment.',
        icon: <ChartBarIcon className="w-16 h-16 text-indigo-400" />,
        cta: 'Launch Suite',
        active: true,
    },
    {
        id: 'jobad',
        title: 'Job Ad Testing Suite',
        description: 'Optimize job descriptions to attract diverse talent by identifying and removing biased language.',
        icon: <BriefcaseIcon className="w-16 h-16 text-indigo-400" />,
        cta: 'Launch Suite',
        active: true,
    }
];

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const goToPrevious = () => {
        const isFirstSlide = currentIndex === 0;
        const newIndex = isFirstSlide ? suites.length - 1 : currentIndex - 1;
        setCurrentIndex(newIndex);
    };

    const goToNext = () => {
        const isLastSlide = currentIndex === suites.length - 1;
        const newIndex = isLastSlide ? 0 : currentIndex + 1;
        setCurrentIndex(newIndex);
    };

    return (
        <div className="min-h-screen text-gray-200 font-sans flex flex-col justify-center items-center">
            <main className="container mx-auto px-4 py-8 md:py-12 text-center">
                <header className="mb-12">
                    <h1 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">
                        AI Quality Assurance Platform
                    </h1>
                    <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
                        A comprehensive suite of tools to test, evaluate, and ensure the quality of your AI-powered applications.
                    </p>
                </header>

                <div className="relative max-w-2xl mx-auto">
                    <div className="overflow-hidden relative rounded-lg">
                        <div
                            className="flex transition-transform duration-500 ease-in-out"
                            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                        >
                            {suites.map((suite) => (
                                <div key={suite.id} className="w-full flex-shrink-0 p-2">
                                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 h-full flex flex-col items-center justify-between shadow-2xl shadow-indigo-500/10 min-h-[380px]">
                                        <div className="flex flex-col items-center">
                                            <div className="mb-6 bg-gray-900/50 p-4 rounded-full">
                                                {suite.icon}
                                            </div>
                                            <h2 className="text-3xl font-bold mb-3">{suite.title}</h2>
                                            <p className="text-gray-400 max-w-sm">{suite.description}</p>
                                        </div>
                                        <button
                                            onClick={suite.active ? () => onNavigate(suite.id) : undefined}
                                            disabled={!suite.active}
                                            className={`mt-8 w-full max-w-xs px-8 py-3 font-semibold rounded-md shadow-lg transition-all duration-300 ${
                                                suite.active
                                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                            }`}
                                        >
                                            {suite.cta}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={goToPrevious}
                        className="absolute top-1/2 -translate-y-1/2 left-0 md:-left-16 p-2 bg-gray-800/50 rounded-full hover:bg-gray-700 transition-colors"
                        aria-label="Previous suite"
                    >
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <button
                        onClick={goToNext}
                        className="absolute top-1/2 -translate-y-1/2 right-0 md:-right-16 p-2 bg-gray-800/50 rounded-full hover:bg-gray-700 transition-colors"
                        aria-label="Next suite"
                    >
                        <ChevronRightIcon className="w-6 h-6" />
                    </button>
                </div>
                 <div className="flex justify-center mt-6 space-x-2">
                    {suites.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`w-3 h-3 rounded-full transition-colors ${
                                currentIndex === index ? 'bg-indigo-500' : 'bg-gray-600 hover:bg-gray-500'
                            }`}
                             aria-label={`Go to suite ${index + 1}`}
                        />
                    ))}
                </div>
            </main>
        </div>
    );
};

export default LandingPage;