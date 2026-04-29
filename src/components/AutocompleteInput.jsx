import React, { useState, useEffect, useRef } from 'react';
import { searchWikipediaArticles } from '../services/wikiService';

export default function AutocompleteInput({ value, onChange, placeholder, className }) {
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (value.trim().length >= 2) {
                setLoading(true);
                const results = await searchWikipediaArticles(value);
                setSuggestions(results);
                setIsOpen(true);
                setLoading(false);
            } else {
                setSuggestions([]);
                setIsOpen(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [value]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (suggestion) => {
        onChange(suggestion);
        setIsOpen(false);
    };

    return (
        <div className="relative flex-1" ref={wrapperRef}>
            <input 
                type="text" 
                placeholder={placeholder}
                value={value} 
                onChange={(e) => {
                    onChange(e.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => {
                    if (suggestions.length > 0) setIsOpen(true);
                }}
                className={`w-full ${className}`}
            />
            
            {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
            )}

            {isOpen && suggestions.length > 0 && (
                <ul className="absolute z-[100] top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto animate-[slideIn_0.2s_ease-out]">
                    {suggestions.map((s, i) => (
                        <li 
                            key={i} 
                            onClick={() => handleSelect(s)}
                            className="px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer transition-colors border-b border-slate-700/50 last:border-none flex items-center gap-2"
                        >
                            <span className="text-slate-400">📄</span> {s}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
