import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { getPageContent, getRandomArticle } from '../services/wikiService';
import { socket } from '../services/socket';
import ToastContainer, { useToast } from '../components/Toast';
import AutocompleteInput from '../components/AutocompleteInput';

export default function GamePage() {
    const { toasts, addToast } = useToast();
    const [gameState, setGameState] = useState('menu'); // 'menu', 'lobby', 'playing', 'finished'
    const [gameMode, setGameMode] = useState('single'); // 'single', 'multi'
    const [gameType, setGameType] = useState('speed'); // 'speed', 'clicks'
    
    // Core Game States
    const [startPage, setStartPage] = useState(null);
    const [endPage, setEndPage] = useState(null);
    const [currentPage, setCurrentPage] = useState(null);
    const [pageHtml, setPageHtml] = useState('');
    const [loading, setLoading] = useState(false);
    const [clicks, setClicks] = useState(0);
    const [timeElapsed, setTimeElapsed] = useState(0);
    const [sections, setSections] = useState([]);
    const [isTocOpen, setIsTocOpen] = useState(true);
    const [pageHistory, setPageHistory] = useState([]);
    
    // Multiplayer States
    const [playerName, setPlayerName] = useState('');
    const [roomId, setRoomId] = useState('');
    const [joinRoomId, setJoinRoomId] = useState('');
    const [players, setPlayers] = useState([]);
    const [hostId, setHostId] = useState('');
    const [winner, setWinner] = useState(null);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(true);
    const [floatingEmojis, setFloatingEmojis] = useState([]);
    
    // Lobby custom page selection
    const [lobbyStartPage, setLobbyStartPage] = useState('');
    const [lobbyEndPage, setLobbyEndPage] = useState('');

    const contentRef = useRef(null);

    // --- SOCKET LISTENERS ---
    useEffect(() => {
        socket.on('room-created', ({ roomId, players, hostId }) => {
            setRoomId(roomId);
            setPlayers(players);
            setHostId(hostId);
            setGameState('lobby');
        });

        socket.on('room-joined', ({ roomId, players, hostId }) => {
            setRoomId(roomId);
            setPlayers(players);
            setHostId(hostId);
            setGameState('lobby');
        });

        socket.on('room-updated', ({ players, hostId }) => {
            setPlayers(players);
            setHostId(hostId);
        });

        socket.on('game-started', async ({ startPage, targetPage, gameMode: gm, players }) => {
            if (gm) setGameType(gm);
            setStartPage(startPage);
            setEndPage(targetPage);
            setCurrentPage(startPage);
            setPlayers(players);
            setClicks(0);
            setTimeElapsed(0);
            setWinner(null);
            setPageHistory([]);
            
            try {
                setLoading(true);
                const content = await getPageContent(startPage);
                setPageHtml(content.text);
                setSections(content.sections || []);
                setGameState('playing');
            } catch (error) {
                console.error("Error loading start page:", error);
                addToast('Başlangıç sayfası yüklenemedi!', 'error');
            } finally {
                setLoading(false);
            }
        });

        socket.on('progress-updated', ({ players }) => {
            setPlayers(players);
        });

        socket.on('game-finished', ({ winner, players }) => {
            setWinner(winner);
            setPlayers(players);
            setGameState('finished');
        });

        socket.on('error', ({ message }) => {
            addToast(message, 'error');
        });

        socket.on('emoji-received', ({ playerName, emoji }) => {
            const id = Date.now() + Math.random();
            setFloatingEmojis(prev => [...prev, { id, playerName, emoji }]);
            setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 3000);
        });

        return () => {
            socket.off('room-created');
            socket.off('room-joined');
            socket.off('room-updated');
            socket.off('game-started');
            socket.off('progress-updated');
            socket.off('game-finished');
            socket.off('error');
            socket.off('emoji-received');
        };
    }, []);

    // --- TIMER ---
    useEffect(() => {
        let timer;
        if (gameState === 'playing' && !winner) {
            timer = setInterval(() => {
                setTimeElapsed((prev) => prev + 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [gameState, winner]);

    // --- CONFETTI ---
    useEffect(() => {
        if (gameState === 'finished') {
            const duration = 3 * 1000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

            const randomInRange = (min, max) => Math.random() * (max - min) + min;

            const interval = setInterval(function() {
                const timeLeft = animationEnd - Date.now();

                if (timeLeft <= 0) {
                    return clearInterval(interval);
                }

                const particleCount = 50 * (timeLeft / duration);
                confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
                confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
            }, 250);
        }
    }, [gameState]);

    // --- ACTION HANDLERS ---
    
    // Single Player Init
    const startSinglePlayer = async () => {
        setGameMode('single');
        setLoading(true);
        try {
            let start = await getRandomArticle();
            let end = await getRandomArticle();
            while (start === end) end = await getRandomArticle();
            
            setStartPage(start);
            setEndPage(end);
            setCurrentPage(start);
            setClicks(0);
            setTimeElapsed(0);
            setPageHistory([]);
            
            const content = await getPageContent(start);
            setPageHtml(content.text);
            setSections(content.sections || []);
            
            setGameState('playing');
        } catch (error) {
            console.error(error);
            addToast("Rastgele makaleler getirilemedi.", 'error');
        } finally {
            setLoading(false);
        }
    };

    // Multiplayer Create Room
    const createRoom = () => {
        if (!playerName.trim()) return addToast("Lütfen bir isim girin", 'warning');
        setGameMode('multi');
        socket.connect();
        socket.emit('create-room', { playerName });
    };

    // Multiplayer Join Room
    const joinRoom = () => {
        if (!playerName.trim()) return addToast('Lütfen bir isim girin', 'warning');
        if (!joinRoomId.trim()) return addToast('Lütfen bir oda kodu girin', 'warning');
        setGameMode('multi');
        socket.connect();
        socket.emit('join-room', { roomId: joinRoomId.toUpperCase(), playerName });
    };

    // Multiplayer Start Game (Host only)
    const handleMultiplayerStart = async () => {
        setLoading(true);
        try {
            let start = lobbyStartPage.trim() || await getRandomArticle();
            let end = lobbyEndPage.trim() || await getRandomArticle();
            while (start === end) end = await getRandomArticle();
            
            socket.emit('start-game', { roomId, startPage: start, targetPage: end, gameMode: gameType });
        } catch (error) {
            console.error(error);
            addToast("Rastgele makaleler getirilemedi.", 'error');
        } finally {
            setLoading(false);
        }
    };

    const randomizeLobbyPage = async (setter) => {
        const title = await getRandomArticle();
        setter(title);
    };

    const sendEmoji = (emoji) => {
        if (gameMode === 'multi') {
            socket.emit('send-emoji', { roomId, emoji });
            const id = Date.now() + Math.random();
            setFloatingEmojis(prev => [...prev, { id, playerName: 'Sen', emoji }]);
            setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 3000);
        }
    };

    const copyRoomCode = () => {
        if (!roomId) return;
        navigator.clipboard.writeText(roomId).then(() => {
            addToast('Oda kodu kopyalandı!', 'success');
        }).catch((err) => {
            console.error('Kopyalama hatası:', err);
            addToast('Kopyalama başarısız oldu.', 'error');
        });
    };

    // --- LINK CLICK HANDLER ---
    useEffect(() => {
        if (!contentRef.current || gameState !== 'playing') return;

        const handleLinkClick = async (e) => {
            const target = e.target.closest('a');
            if (!target) return;

            const href = target.getAttribute('href');
            
            if (href && href.startsWith('/wiki/') && !href.includes(':')) {
                e.preventDefault();
                const rawTarget = decodeURIComponent(href.replace('/wiki/', ''));
                const targetTitle = rawTarget.replace(/_/g, ' ');
                
                try {
                    setLoading(true);
                    
                    setPageHistory(prev => [...prev, currentPage]);

                    const newClicks = clicks + 1;
                    setClicks(newClicks);
                    setCurrentPage(targetTitle);
                    
                    // Emit progress in multiplayer
                    if (gameMode === 'multi') {
                        socket.emit('update-progress', { roomId, currentPage: targetTitle, clicks: newClicks });
                    }
                    
                    const content = await getPageContent(targetTitle);
                    setPageHtml(content.text);
                    setSections(content.sections || []);
                    
                    // Check Win Condition
                    if (targetTitle.toLowerCase() === endPage?.toLowerCase()) {
                        if (gameMode === 'single') {
                            setGameState('finished');
                        } else {
                            socket.emit('finish-game', { roomId, timeElapsed });
                        }
                    }
                } catch (error) {
                    addToast('Sayfa yüklenirken bir hata oluştu.', 'error');
                } finally {
                    setLoading(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } else if (href && href.startsWith('#')) {
                // Allow anchor
            } else {
                e.preventDefault();
            }
        };

        const container = contentRef.current;
        container.addEventListener('click', handleLinkClick);
        return () => container.removeEventListener('click', handleLinkClick);
    }, [pageHtml, endPage, gameState, clicks, gameMode, roomId, timeElapsed, currentPage]);

    const goBack = async () => {
        if (pageHistory.length === 0 || loading) return;
        const previousPage = pageHistory[pageHistory.length - 1];
        try {
            setLoading(true);
            const newClicks = clicks + 1;
            setClicks(newClicks);
            setCurrentPage(previousPage);
            setPageHistory(prev => prev.slice(0, -1));

            if (gameMode === 'multi') {
                socket.emit('update-progress', { roomId, currentPage: previousPage, clicks: newClicks });
            }

            const content = await getPageContent(previousPage);
            setPageHtml(content.text);
            setSections(content.sections || []);
        } catch (error) {
            addToast('Önceki sayfaya dönülemedi.', 'error');
        } finally {
            setLoading(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // --- HELPERS ---
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // ==========================================
    // RENDER SCREENS
    // ==========================================

    if (gameState === 'menu') {
        return (
            <>
            <ToastContainer toasts={toasts} />
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white p-4 relative overflow-hidden">
                {/* Background ambient lights */}
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/20 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-purple-600/10 blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>
                
                {/* Floating decor */}
                <div className="absolute top-20 left-20 text-4xl opacity-10 animate-bounce" style={{ animationDuration: '3s' }}>📄</div>
                <div className="absolute bottom-32 left-1/4 text-4xl opacity-10 animate-bounce" style={{ animationDuration: '4s' }}>🔍</div>
                <div className="absolute top-40 right-1/4 text-4xl opacity-10 animate-bounce" style={{ animationDuration: '5s' }}>⚡</div>
                <div className="absolute bottom-20 right-20 text-4xl opacity-10 animate-bounce" style={{ animationDuration: '3.5s' }}>🏆</div>
                
                <div className="bg-slate-800/40 backdrop-blur-2xl border border-white/10 p-8 sm:p-12 rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] max-w-md w-full text-center z-10 animate-[slideIn_0.5s_ease-out]">
                    <div className="flex justify-center mb-4">
                        <div className="w-20 h-20 bg-gradient-to-tr from-blue-500 to-emerald-400 rounded-2xl flex items-center justify-center text-4xl shadow-xl shadow-blue-500/30 transform rotate-3 hover:rotate-0 transition-transform cursor-pointer">
                            W
                        </div>
                    </div>
                    <h1 className="text-5xl sm:text-6xl font-black mb-3 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 tracking-tighter drop-shadow-sm">
                        WikiSprint
                    </h1>
                    <p className="text-slate-400 mb-8 font-medium">Hedefe giden en kısa yolu bul!</p>
                    
                    {/* Game Type Selector */}
                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={() => setGameType('speed')}
                            className={`flex-1 py-3.5 rounded-2xl font-bold transition-all border ${gameType === 'speed' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                        >
                            ⚡ Hız Modu
                        </button>
                        <button
                            onClick={() => setGameType('clicks')}
                            className={`flex-1 py-3.5 rounded-2xl font-bold transition-all border ${gameType === 'clicks' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                        >
                            🖱️ Tıklama Modu
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 mb-6 -mt-4">
                        {gameType === 'speed' ? 'En kısa sürede hedefe ulaş!' : 'En az tıklama ile hedefe ulaş!'}
                    </p>

                    <div className="flex flex-col gap-4">
                        <button 
                            onClick={startSinglePlayer}
                            disabled={loading}
                            className="w-full py-4 bg-slate-700/50 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all border border-slate-600/50 hover:border-slate-400 hover:-translate-y-1 hover:shadow-lg active:translate-y-0 flex justify-center items-center gap-2"
                        >
                            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : '🎮 Tek Oyunculu Oyna'}
                        </button>
                        
                        <div className="w-full h-px bg-slate-700 my-4 relative">
                            <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-800 px-4 text-xs text-slate-500 uppercase font-bold">Veya Multiplayer</span>
                        </div>

                        <input 
                            type="text" 
                            placeholder="Oyuncu Adın (Örn: Neo)"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            className="w-full bg-slate-900/50 border border-slate-600/50 rounded-2xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all mb-2 text-center font-medium"
                        />

                        <button 
                            onClick={createRoom}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/25 hover:-translate-y-1 hover:shadow-blue-500/40 active:translate-y-0"
                        >
                            🚀 Yeni Oda Kur
                        </button>
                        
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 bg-slate-800/30 p-2 rounded-[1.75rem] border border-white/5 mt-2">
                            <input 
                                type="text" 
                                placeholder="Oda Kodu (Örn: ABCD)"
                                value={joinRoomId}
                                onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                                className="flex-1 bg-slate-900/50 border border-slate-600/50 rounded-2xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-center uppercase font-bold tracking-widest w-full"
                                maxLength={6}
                            />
                            <button 
                                onClick={joinRoom}
                                className="sm:flex-1 w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/25 hover:-translate-y-1 hover:shadow-emerald-500/40 active:translate-y-0 flex justify-center items-center gap-2"
                            >
                                🤝 Katıl
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            </>
        );
    }

    if (gameState === 'lobby') {
        const isHost = hostId === socket.id;
        
        return (
            <>
            <ToastContainer toasts={toasts} />
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white p-4 relative overflow-hidden">
                {/* Background ambient lights */}
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
                
                <div className="bg-slate-800/40 backdrop-blur-2xl border border-white/10 p-8 sm:p-10 rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] max-w-xl w-full text-center z-10 animate-[slideIn_0.4s_ease-out]">
                    <h2 className="text-3xl font-black mb-4 flex items-center justify-center gap-3">
                        <span className="text-4xl">🛋️</span> Bekleme Salonu
                    </h2>
                    
                    <div className="bg-slate-900/60 py-4 px-6 rounded-2xl inline-block mb-8 border border-white/5 shadow-inner relative group">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Oda Kodu</span>
                        <div className="flex items-center justify-center gap-3">
                            <p className="text-5xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 tracking-widest">{roomId}</p>
                            <button 
                                onClick={copyRoomCode}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all border border-slate-700/50 hover:border-slate-500 hover:text-white"
                                title="Kodu Kopyala"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="mb-8 text-left">
                        <h3 className="text-slate-400 uppercase tracking-wider text-xs font-bold mb-3 px-2">Oyuncular ({players.length})</h3>
                        <div className="bg-slate-900/30 rounded-2xl p-2 border border-slate-700/50 flex flex-col gap-2 max-h-60 overflow-y-auto">
                            {players.map(p => (
                                <div key={p.id} className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold">
                                            {p.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-medium">{p.name} {p.id === socket.id ? '(Sen)' : ''}</span>
                                    </div>
                                    {p.id === hostId && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded-lg border border-amber-500/30">Kurucu</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Game Type Selector (Host only) */}
                    {isHost && (
                        <div className="mb-6">
                            <h3 className="text-slate-400 uppercase tracking-wider text-xs font-bold mb-3 px-2">Oyun Modu</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setGameType('speed')}
                                    className={`flex-1 py-3.5 rounded-2xl font-bold transition-all border ${gameType === 'speed' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    ⚡ Hız Modu
                                </button>
                                <button
                                    onClick={() => setGameType('clicks')}
                                    className={`flex-1 py-3.5 rounded-2xl font-bold transition-all border ${gameType === 'clicks' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    🖱️ Tıklama Modu
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-2 text-center">
                                {gameType === 'speed' ? 'En kısa sürede hedefe ulaşan kazanır!' : 'En az tıklama ile hedefe ulaşan kazanır!'}
                            </p>
                        </div>
                    )}

                    {/* Custom Word Selection (Host only) */}
                    {isHost && (
                        <div className="mb-6 text-left">
                            <h3 className="text-slate-400 uppercase tracking-wider text-xs font-bold mb-3 px-2">Makale Seçimi</h3>
                            <div className="flex flex-col gap-3">
                                <div className="flex gap-2">
                                    <AutocompleteInput 
                                        placeholder="Başlangıç makalesi (boş = rastgele)"
                                        value={lobbyStartPage}
                                        onChange={setLobbyStartPage}
                                        className="bg-slate-900/50 border border-slate-600 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                    <button onClick={() => randomizeLobbyPage(setLobbyStartPage)} className="px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-2xl text-lg transition-colors" title="Rastgele">🎲</button>
                                </div>
                                <div className="flex gap-2">
                                    <AutocompleteInput 
                                        placeholder="Hedef makale (boş = rastgele)"
                                        value={lobbyEndPage}
                                        onChange={setLobbyEndPage}
                                        className="bg-slate-900/50 border border-slate-600 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                    <button onClick={() => randomizeLobbyPage(setLobbyEndPage)} className="px-4 py-3 bg-slate-700/80 hover:bg-slate-600 rounded-2xl text-lg transition-transform hover:scale-110 active:scale-95 shadow-md border border-white/10" title="Rastgele">🎲</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isHost && (
                        <div className="py-6 bg-slate-900/40 border border-white/5 rounded-2xl shadow-inner mb-6 flex flex-col items-center justify-center gap-3 animate-pulse">
                            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-slate-300 font-medium">Kurucunun oyunu başlatması bekleniyor...</p>
                        </div>
                    )}

                    {isHost && (
                        <button 
                            onClick={handleMultiplayerStart}
                            disabled={loading || players.length < 2}
                            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-500/25 hover:-translate-y-1 hover:shadow-emerald-500/40 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                        >
                            {loading ? 'Hazırlanıyor...' : (players.length < 2 ? '⏳ Oyuncu Bekleniyor...' : '🏁 Oyunu Başlat')}
                        </button>
                    )}
                </div>
            </div>
            </>
        );
    }

    if (gameState === 'playing') {
        return (
            <>
            <ToastContainer toasts={toasts} />
            <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center pb-20 w-full relative">
                
                {/* HUD / Header */}
                <div className="sticky top-0 z-50 w-full bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 shadow-2xl transition-all">
                    <div className="w-full px-3 sm:px-8 py-2 sm:py-3 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4">
                        
                        <div className="flex flex-col gap-1 w-full md:w-auto">
                            <span className="hidden sm:block text-slate-400 font-semibold uppercase tracking-wider text-[10px] sm:text-xs">Görev Rotası</span>
                            <div className="flex items-center gap-2 sm:gap-3 bg-slate-800/80 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-slate-700/50 shadow-inner overflow-hidden">
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold leading-none mb-0.5">Başlangıç</span>
                                    <span className="text-blue-400 font-medium break-words leading-tight text-sm sm:text-base">{startPage}</span>
                                </div>
                                <div className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 shadow-sm text-xs sm:text-base">→</div>
                                <div className="flex flex-col min-w-0 flex-1 text-right sm:text-left">
                                    <span className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold leading-none mb-0.5">Hedef</span>
                                    <span className="text-emerald-400 font-medium break-words leading-tight text-sm sm:text-base">{endPage}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex flex-row items-center justify-between w-full md:w-auto gap-2">
                            <button 
                                onClick={goBack} 
                                disabled={pageHistory.length === 0 || loading}
                                className={`flex flex-col items-center justify-center gap-1 bg-slate-800/50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-slate-700/30 transition-all flex-shrink-0 ${pageHistory.length > 0 && !loading ? 'hover:bg-slate-700 cursor-pointer active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
                                title="Önceki Sayfaya Dön (+1 Tık)"
                            >
                                <span className="text-xl sm:text-2xl leading-none">↩️</span>
                                <span className="text-[8px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider">Geri</span>
                            </button>

                            <div className="flex items-center justify-center gap-4 sm:gap-8 bg-slate-800/50 px-4 sm:px-6 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-slate-700/30 flex-1 md:flex-none">
                                <div className="flex flex-col items-center">
                                    <span className="text-slate-400 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider leading-none mb-0.5">Tıklama</span>
                                    <span className="text-xl sm:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-br from-blue-400 to-indigo-400 leading-none">{clicks}</span>
                                </div>
                                <div className="w-px h-8 sm:h-10 bg-slate-700/50"></div>
                                <div className="flex flex-col items-center">
                                    <span className="text-slate-400 text-[9px] sm:text-[10px] uppercase font-bold tracking-wider leading-none mb-0.5">Süre</span>
                                    <span className="text-xl sm:text-3xl font-black font-mono bg-clip-text text-transparent bg-gradient-to-br from-amber-400 to-orange-400 leading-none">{formatTime(timeElapsed)}</span>
                                </div>
                            </div>

                            {/* Emoji Bar (Multiplayer) */}
                            {gameMode === 'multi' && (
                                <div className="flex flex-wrap md:flex-nowrap justify-center items-center gap-1 bg-slate-800/50 px-2 sm:px-3 py-1 sm:py-1 rounded-xl sm:rounded-2xl border border-slate-700/30 flex-shrink-0 max-w-[120px] sm:max-w-none">
                                    {['🔥','😂','😱','👀','💀','🏃'].map(e => (
                                        <button key={e} onClick={() => sendEmoji(e)} className="text-sm sm:text-xl hover:scale-125 transition-transform p-0.5 sm:p-1">{e}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Floating Emojis */}
                <div className="fixed top-20 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
                    {floatingEmojis.map(fe => (
                        <div key={fe.id} className="bg-slate-800/90 backdrop-blur-sm px-4 py-2 rounded-2xl border border-slate-700 text-white text-sm animate-[slideIn_0.3s_ease-out] shadow-lg pointer-events-none">
                            <span className="text-xl mr-2">{fe.emoji}</span><span className="text-slate-400">{fe.playerName}</span>
                        </div>
                    ))}
                </div>

                <div className="w-full flex flex-col xl:flex-row gap-3 sm:gap-4 px-2 sm:px-6 md:px-8 mt-3 sm:mt-6">

                    {/* Content Area */}
                    <main className="flex-1 relative order-1 min-w-0">
                        {loading && (
                            <div className="absolute inset-0 z-10 flex justify-center pt-32 bg-slate-900/40 backdrop-blur-[2px] rounded-lg transition-all duration-300">
                                <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-blue-500/20"></div>
                            </div>
                        )}
                        
                        <div className="wiki-wrapper w-full flex flex-col md:flex-row gap-6 items-start">
                            {/* Inner TOC (Left side of white wrapper) */}
                            {sections && sections.length > 0 && (
                                <div className="w-full md:w-56 lg:w-64 flex-shrink-0 sticky top-28 bg-[#f8f9fa] border border-[#a2a9b1] p-4 text-[95%]">
                                    <h2 className="font-sans font-bold text-black mb-2 pb-2 border-b border-[#a2a9b1]">İçindekiler</h2>
                                    <ul className="flex flex-col gap-1.5 overflow-y-auto max-h-[calc(100vh-200px)] custom-scrollbar pr-2">
                                        {sections.map((sec, idx) => (
                                            <li key={idx} style={{ marginLeft: `${(sec.toclevel - 1) * 12}px` }}>
                                                <a 
                                                    href={`#${sec.anchor}`} 
                                                    className="text-[#0645ad] hover:underline" 
                                                    dangerouslySetInnerHTML={{ __html: `${sec.number}. ${sec.line}` }} 
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Main Text Content */}
                            <div className="flex-1 min-w-0">
                                <h1 className="text-2xl sm:text-4xl font-serif font-bold text-black mb-3 sm:mb-4 border-b border-gray-300 pb-2 leading-tight break-words">
                                    {currentPage}
                                </h1>
                                <div ref={contentRef} className="wiki-content" dangerouslySetInnerHTML={{ __html: pageHtml }} />
                            </div>
                        </div>
                    </main>

                    {/* Multiplayer Leaderboard Sidebar */}
                    {gameMode === 'multi' && (
                        <aside className={`flex-shrink-0 order-3 xl:order-3 transition-all duration-300 ${isLeaderboardOpen ? 'w-full xl:w-80' : 'w-full xl:w-16'}`}>
                            <div className="sticky top-28 bg-slate-800/80 backdrop-blur-md border border-slate-700/50 rounded-3xl p-4 shadow-2xl overflow-hidden flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    {isLeaderboardOpen && (
                                        <h3 className="text-lg font-black text-white flex items-center gap-2">
                                            <span className="relative flex h-3 w-3">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                            </span>
                                            Skor Tablosu
                                        </h3>
                                    )}
                                    <button 
                                        onClick={() => setIsLeaderboardOpen(!isLeaderboardOpen)}
                                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full transition-colors mx-auto xl:mx-0"
                                        title={isLeaderboardOpen ? "Tabloyu Küçült" : "Tabloyu Büyüt"}
                                    >
                                        {isLeaderboardOpen ? (
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                        ) : (
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                                        )}
                                    </button>
                                </div>
                                
                                {isLeaderboardOpen ? (
                                    <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {players.sort((a,b) => b.clicks - a.clicks).map((p, index) => (
                                            <div key={p.id} className={`p-4 rounded-2xl border ${p.id === socket.id ? 'bg-blue-600/20 border-blue-500/50' : 'bg-slate-900/50 border-slate-700/50'} transition-all`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-bold text-sm pr-2 break-all" title={p.name}>
                                                        {index + 1}. {p.name} {p.id === socket.id && '(Sen)'}
                                                    </span>
                                                    <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300 font-mono flex-shrink-0">
                                                        {p.clicks} tık
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-400 break-words line-clamp-2">
                                                    📍 {p.currentPage || startPage}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto hidden xl:flex items-center">
                                        {players.sort((a,b) => b.clicks - a.clicks).map((p, index) => (
                                            <div key={p.id} title={`${p.name} - ${p.clicks} tık`} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${p.id === socket.id ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                                                {p.name.charAt(0).toUpperCase()}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </aside>
                    )}
                </div>
            </div>
            </>
        );
    }

    if (gameState === 'finished') {
        const isMulti = gameMode === 'multi';
        const winPlayer = isMulti ? winner : { name: 'Sen', clicks, timeElapsed };
        
        return (
            <>
            <ToastContainer toasts={toasts} />
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4 relative overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-amber-600/10 blur-[150px] animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-orange-600/10 blur-[150px] animate-pulse"></div>
                
                <div className="bg-slate-800/80 backdrop-blur-xl border border-amber-500/30 p-8 sm:p-12 rounded-[2rem] shadow-[0_0_80px_-15px_rgba(245,158,11,0.4)] max-w-xl w-full text-center z-10 animate-[slideIn_0.5s_ease-out]">
                    <div className="w-28 h-28 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-8 text-6xl shadow-2xl shadow-amber-500/40 animate-bounce">
                        🏆
                    </div>
                    <h2 className="text-4xl font-black text-white mb-1">Oyun Bitti!</h2>
                    <p className="text-xs text-slate-500 mb-4 uppercase font-bold tracking-wider">
                        {gameType === 'speed' ? '⚡ Hız Modu' : '🖱️ Tıklama Modu'}
                    </p>
                    <p className="text-slate-300 mb-8 text-lg">
                        <span className="text-amber-400 font-bold">{winPlayer?.name}</span>, {gameType === 'speed' ? 'en hızlı şekilde hedefe ulaştı!' : 'en az tıklama ile hedefe ulaştı!'}
                    </p>
                    
                    {isMulti && (
                        <div className="bg-slate-900/50 rounded-2xl border border-slate-700 p-4 mb-8 text-left">
                            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Sıralama</h3>
                            <div className="flex flex-col gap-2">
                                {players.map((p, i) => (
                                    <div key={p.id} className={`flex justify-between items-center p-3 rounded-xl border ${p.isFinished ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-slate-800 border-slate-700'}`}>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold w-4">{i+1}.</span>
                                            <span className="font-medium truncate max-w-[100px] sm:max-w-[150px]">{p.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm font-mono text-slate-300">
                                            <span>{p.clicks} tık</span>
                                            <span className={p.isFinished ? 'text-amber-400' : 'text-slate-500'}>
                                                {p.isFinished ? formatTime(p.timeElapsed) : 'Bitiremedi'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!isMulti && (
                        <div className="grid grid-cols-2 gap-4 mb-10">
                            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Geçen Süre</p>
                                <p className="text-3xl font-black text-amber-400 font-mono">{formatTime(timeElapsed)}</p>
                            </div>
                            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Toplam Tıklama</p>
                                <p className="text-3xl font-black text-blue-400">{clicks}</p>
                            </div>
                        </div>
                    )}
                    
                    <button 
                        onClick={() => {
                            if (isMulti) {
                                socket.disconnect();
                            }
                            window.location.reload();
                        }}
                        className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-amber-500/20 active:scale-95"
                    >
                        Ana Menüye Dön
                    </button>
                </div>
            </div>
            </>
        );
    }

    return <ToastContainer toasts={toasts} />;
}
