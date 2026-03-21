'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type GameMode = 'comedy' | 'nerd' | 'crowd' | 'democracy';
type QuestionType = 'edgy' | 'funny' | 'factual' | 'trueFalse' | 'currentEvents';

interface Question {
  id: string;
  category: string;
  text: string;
  options: string[];
  correctAnswer: number;
  funniestAnswer: number;
  type: QuestionType;
}

interface Room {
  code: string;
  players: string[];
  currentQuestion: number;
  gameMode: GameMode;
  soloTest?: boolean;
}

export default function TriviaGamePage() {
  const [gameState, setGameState] = useState<'menu' | 'hosting' | 'joining' | 'playing'>('menu');
  const [room, setRoom] = useState<Room | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameMode, setGameMode] = useState<GameMode>('comedy');

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  };

  const startHosting = () => {
    if (!playerName.trim()) return;
    const newRoom: Room = {
      code: generateRoomCode(),
      players: [playerName],
      currentQuestion: 0,
      gameMode,
    };
    setRoom(newRoom);
    setGameState('hosting');
  };

  const startSoloTest = () => {
    const soloName = playerName.trim() || 'Solo Tester';
    const newRoom: Room = {
      code: 'SOLO',
      players: [soloName],
      currentQuestion: 0,
      gameMode,
      soloTest: true,
    };
    setPlayerName(soloName);
    setRoom(newRoom);
    setGameState('hosting');
  };

  const joinRoom = () => {
    if (!playerName.trim() || !roomCode.trim()) return;
    // In real implementation, this would connect to WebSocket
    setGameState('joining');
  };

  const gameModeDescriptions = {
    comedy: 'Funniest answer: 100pts, Correct: 50pts, Popular: 25pts',
    nerd: 'Correct answer: 100pts, Funniest: 50pts, Popular: 0pts',
    crowd: 'Funniest answer: 100pts, Correct: 50pts, Popular: 0pts',
    democracy: 'Most popular answer wins, regardless of correctness',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold text-white mb-4 font-mono">
            PIN <span className="text-yellow-400">TRIVIA</span>
          </h1>
          <p className="text-xl text-gray-300">
            Multiplayer-style trivia with edgy humor, era-based categories, and video game references
          </p>
        </div>

        {gameState === 'menu' && (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Host Game */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-2xl">🎭 Host Game</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />

                <div>
                  <label className="text-white font-semibold mb-2 block">Game Mode</label>
                  <div className="space-y-2">
                    {(Object.entries(gameModeDescriptions) as [GameMode, string][]).map(([mode, desc]) => (
                      <div key={mode}>
                        <Button
                          variant={gameMode === mode ? "default" : "outline"}
                          onClick={() => setGameMode(mode)}
                          className="w-full justify-start mb-1"
                        >
                          {mode === 'comedy' && '🎭'}
                          {mode === 'nerd' && '🤓'}
                          {mode === 'crowd' && '👥'}
                          {mode === 'democracy' && '🗳️'}
                          {mode.charAt(0).toUpperCase() + mode.slice(1)} Mode
                        </Button>
                        <p className="text-xs text-gray-400 px-2">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={startHosting}
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={!playerName.trim()}
                >
                  Create Room
                </Button>
                <Button
                  onClick={startSoloTest}
                  className="w-full bg-amber-600 hover:bg-amber-700"
                >
                  Solo Test (No Join Needed)
                </Button>
              </CardContent>
            </Card>

            {/* Join Game */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-2xl">📱 Join Game</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <Input
                  placeholder="Room Code (e.g. ABCD)"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="bg-gray-700 border-gray-600 text-white"
                  maxLength={4}
                />
                <Button
                  onClick={joinRoom}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={!playerName.trim() || !roomCode.trim()}
                >
                  Join Room
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {gameState === 'hosting' && room && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-2xl">
                🎮 Room: <span className="text-yellow-400 font-mono">{room.code}</span>
              </CardTitle>
              <div className="flex gap-2">
                <Badge variant="secondary">
                  {room.gameMode.charAt(0).toUpperCase() + room.gameMode.slice(1)} Mode
                </Badge>
                <Badge variant="outline" className="text-white">
                  {room.players.length} Player{room.players.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-white font-semibold mb-2">Players:</h3>
                  <div className="flex flex-wrap gap-2">
                    {room.players.map((player, index) => (
                      <Badge key={index} variant="default">
                        {player}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-700 p-4 rounded-lg">
                  <p className="text-gray-300 mb-2">
                    Players can join by going to <strong>dashboard/trivia</strong> and entering code:
                  </p>
                  <div className="text-4xl font-mono text-yellow-400 text-center">
                    {room.code}
                  </div>
                </div>

                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={room.players.length < (room.soloTest ? 1 : 2)}
                >
                  Start Game ({room.soloTest || room.players.length >= 2 ? 'Ready!' : 'Need 2+ players'})
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {gameState === 'joining' && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-2xl">🔌 Connecting...</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">
                Attempting to join room <span className="font-mono text-yellow-400">{roomCode}</span>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Question Categories Preview */}
        <div className="mt-12">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">📚 Category Examples</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: "Dating Red Flags Through History", emoji: "💔", era: "All Eras" },
              { name: "80s Arcade Therapy", emoji: "🕹️", era: "1980s" },
              { name: "Songs That Hit Different Now", emoji: "🎵", era: "Various" },
              { name: "2026 Chaos Chronicles", emoji: "📱", era: "Current" },
              { name: "Things Your Ex Would Google", emoji: "💻", era: "Modern" },
              { name: "Video Game Logic in Real Life", emoji: "🎮", era: "Gaming" },
            ].map((category, index) => (
              <Card key={index} className="bg-gray-800 border-gray-700">
                <CardContent className="p-4 text-center">
                  <div className="text-3xl mb-2">{category.emoji}</div>
                  <h3 className="text-white font-semibold">{category.name}</h3>
                  <Badge variant="outline" className="text-gray-400 mt-2">
                    {category.era}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
