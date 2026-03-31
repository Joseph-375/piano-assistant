import React, { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import * as mm from '@magenta/music';
import SheetMusic from './SheetMusic';

const Piano = () => {
  const sampler = useRef(null);
  const music_rnn = useRef(null);
  const metroSynth = useRef(null);
  const metroLoop = useRef(null);
  // Add this new state
  const [realtimeNotes, setRealtimeNotes] = useState([]);
  
  // NEW: Visualizer Refs
  const analyser = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // States
  const [isLoaded, setIsLoaded] = useState(false);
  const [aiLoaded, setAiLoaded] = useState(false);
  const [sustain, setSustain] = useState(true); 
  const [isRecording, setIsRecording] = useState(false);
  const [currentRecording, setCurrentRecording] = useState([]); 
  const [startTime, setStartTime] = useState(0);
  const [activeKeys, setActiveKeys] = useState([]); 
  const [bpm, setBpm] = useState(120);
  const [metroOn, setMetroOn] = useState(false);
  const [songToDelete, setSongToDelete] = useState(null);
  // NEW: Custom Save Modal States
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newSongName, setNewSongName] = useState("");
  const [savedSongs, setSavedSongs] = useState(() => {
    const saved = localStorage.getItem("pianoSongs");
    return saved ? JSON.parse(saved) : [];
  });
// Opens our custom modal instead of the browser prompt
  const openSaveModal = () => {
    setNewSongName(`Song #${savedSongs.length + 1}`); // Default name
    setIsSaveModalOpen(true);
  };

  // Handles the actual saving when they click "Save" in our modal
  const confirmSaveSong = () => {
    if (newSongName.trim()) { 
      setSavedSongs(prev => [...prev, { id: Date.now(), name: newSongName.trim(), notes: currentRecording }]); 
      setCurrentRecording([]); 
      setIsSaveModalOpen(false); // Close modal
    }
  };

  // Closes the modal without saving
  const cancelSave = () => {
    setIsSaveModalOpen(false);
  };

  // KEYBOARD MAPPING - STUDIO LAYOUT
  const KEY_MAP = {
    // Low Octave (C3)
    'z': 'C3', 'x': 'D3', 'c': 'E3', 'v': 'F3', 'b': 'G3', 'n': 'A3', 'm': 'B3',
    's': 'C#3', 'd': 'D#3', 'g': 'F#3', 'h': 'G#3', 'j': 'A#3',
    // Middle Octave (C4)
    'q': 'C4', 'w': 'D4', 'e': 'E4', 'r': 'F4', 't': 'G4', 'y': 'A4', 'u': 'B4', 'i': 'C5',
    '2': 'C#4', '3': 'D#4', '5': 'F#4', '6': 'G#4', '7': 'A#4'
  };

  useEffect(() => {
    // 1. Setup Analyzer (The "Ear" for the visualizer)
    // 512 = resolution of the wave
    analyser.current = new Tone.Waveform(512);

    // 2. Setup Piano
    sampler.current = new Tone.Sampler({
      urls: {
        "A0": "A0.mp3", "C1": "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3",
        "A1": "A1.mp3", "C2": "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
        "A2": "A2.mp3", "C3": "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
        "A3": "A3.mp3", "C4": "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
        "A4": "A4.mp3", "C5": "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
        "A5": "A5.mp3", "C6": "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3",
        "A6": "A6.mp3", "C7": "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3",
        "A7": "A7.mp3", "C8": "C8.mp3"
      },
      release: 3,
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      onload: () => {
        setIsLoaded(true);
        console.log("Piano loaded");
      }
    }).connect(analyser.current).toDestination(); 
    // ^ Connect Piano -> Analyzer -> Speakers

    // 3. Setup AI
    music_rnn.current = new mm.MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn');
    music_rnn.current.initialize().then(() => setAiLoaded(true));

    // 4. Setup Metronome
    metroSynth.current = new Tone.MembraneSynth().toDestination();
    metroSynth.current.volume.value = -10;

    return () => {
      if (sampler.current) sampler.current.dispose();
      if (music_rnn.current) music_rnn.current.dispose();
      if (metroSynth.current) metroSynth.current.dispose();
      if (metroLoop.current) metroLoop.current.dispose();
      if (analyser.current) analyser.current.dispose();
      cancelAnimationFrame(animationRef.current); // Stop drawing
    };
  }, []);

  // --- NEW: VISUALIZER LOOP ---
  useEffect(() => {
    const draw = () => {
      if (!canvasRef.current || !analyser.current) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const buffer = analyser.current.getValue(); // Get audio data

      // Clear screen
      ctx.fillStyle = "#222"; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Wave
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#00d2ff"; // Neon Blue
      ctx.beginPath();

      const sliceWidth = canvas.width / buffer.length;
      let x = 0;

      for (let i = 0; i < buffer.length; i++) {
        const v = buffer[i]; // Value is between -1 and 1
        // Map value to canvas height
        const y = (v * canvas.height / 3) + (canvas.height / 2);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }

      ctx.stroke();
      animationRef.current = requestAnimationFrame(draw);
    };

    draw(); // Start loop

    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  // ... (Keyboard Handlers, Audio Functions, AI Logic remain the same) ...
  
  // (Paste your existing Handle Computer Keyboard useEffect here)
  useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.repeat) return;
        const note = KEY_MAP[e.key.toLowerCase()];
        if (note) playNote(note);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLoaded, isRecording, startTime]);
  
  // (Paste Metronome useEffect here)
  useEffect(() => {
      Tone.Transport.bpm.value = bpm;
      if (metroOn) {
        if (!metroLoop.current) {
          metroLoop.current = new Tone.Loop((time) => {
            metroSynth.current.triggerAttackRelease("C1", "32n", time);
          }, "4n");
        }
        metroLoop.current.start(0);
        if (Tone.Transport.state !== 'started') Tone.Transport.start();
      } else {
        if (metroLoop.current) metroLoop.current.stop();
      }
    }, [metroOn, bpm]);
  
  // (Paste Storage and Sustain useEffects here)
  useEffect(() => { localStorage.setItem("pianoSongs", JSON.stringify(savedSongs)); }, [savedSongs]);
  useEffect(() => { if (sampler.current) sampler.current.release = sustain ? 3 : 0.5; }, [sustain]);


  // Helper Functions (Same as before)
  const ensureAudioStarted = async () => { if (Tone.context.state !== 'running') await Tone.start(); };
  
const playNote = async (note) => {
    if (!isLoaded) return;
    await ensureAudioStarted();
    
    if (sampler.current) sampler.current.triggerAttackRelease(note, "8n");
    
    // Visual feedback (Keys lighting up)
    setActiveKeys(prev => [...prev, note]);
    setTimeout(() => setActiveKeys(prev => prev.filter(n => n !== note)), 200);

    // --- NEW: Always update the Sheet Music (Keep last 12 notes) ---
    setRealtimeNotes(prev => {
      const newNotes = [...prev, { note, time: Date.now() }];
      return newNotes.slice(-12); // Keep only the last 12 notes so it fits
    });
    // -------------------------------------------------------------

    // Recording logic (Only if Red Rec button is on)
    if (isRecording) {
      const timeOffset = Date.now() - startTime;
      setCurrentRecording(prev => [...prev, { note, time: timeOffset }]);
    }
  };

  // (AI Finish Song - KEEP YOUR FIXED VERSION)
  const aiFinishSong = async () => {
      if (currentRecording.length < 3) return alert("Play at least 3 notes first!");
      if (!aiLoaded) return alert("AI is waking up...");
      const notesForAI = currentRecording.map((n, index) => ({
        pitch: Math.floor(Tone.Frequency(n.note).toMidi()), 
        startTime: index * 0.5, endTime: (index * 0.5) + 0.4
      }));
      const quantizedSeq = mm.sequences.quantizeNoteSequence({ notes: notesForAI, totalTime: notesForAI.length * 0.5 }, 4);
      const result = await music_rnn.current.continueSequence(quantizedSeq, 20, 1.2);
      const aiNotes = result.notes.map(n => ({
        note: Tone.Frequency(n.pitch, "midi").toNote(),
        time: currentRecording[currentRecording.length - 1].time + (n.quantizedStartStep * 125) 
      }));
      const fullSong = [...currentRecording, ...aiNotes];
      setCurrentRecording(fullSong); 
      playSong(aiNotes);
  };

  // (Controls - Same as before)
  const startRecording = () => { setCurrentRecording([]); setStartTime(Date.now()); setIsRecording(true); };
  const stopRecording = () => { setIsRecording(false); };
  const deleteSong = (id) => { if (window.confirm("Delete this song?")) setSavedSongs(prev => prev.filter(s => s.id !== id)); };
  
  const playSong = async (songNotes) => {
    if (!songNotes || songNotes.length === 0) return;
    await ensureAudioStarted();
    const sortedNotes = [...songNotes].sort((a, b) => a.time - b.time);
    sortedNotes.forEach(({ note, time }) => {
      const playTime = time - sortedNotes[0].time; 
      setTimeout(() => {
        if (sampler.current) sampler.current.triggerAttackRelease(note, "8n");
        setActiveKeys(prev => [...prev, note]);
        setTimeout(() => setActiveKeys(prev => prev.filter(n => n !== note)), 200);
      }, playTime);
    });
  };
  const getKeyClass = (note, type) => {
    const isActive = activeKeys.includes(note);
    return `${type}-key ${isActive ? 'active' : ''}`;
  };

  return (
    <div className="piano-container">
      <h2>🎹 Ultimate AI Studio</h2>
      
      {!isLoaded && <div className="loading">⏳ Loading Sounds...</div>}

      {/* NEW: VISUALIZER CANVAS */}
      <div className="visualizer-container">
        <canvas ref={canvasRef} width="600" height="100" className="visualizer-canvas"></canvas>
      </div>

      <div className="metronome-controls">
         <button className={`metro-btn ${metroOn ? 'active' : ''}`} onClick={() => setMetroOn(!metroOn)}>
           ⏱ Metronome: {metroOn ? "ON" : "OFF"}
         </button>
         <div className="bpm-slider">
            <label>Speed: {bpm} BPM</label>
            <input type="range" min="60" max="240" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
         </div>
      </div>
      {/* --- SHEET MUSIC SECTION --- */}
      <div className="sheet-music-container">
         {/* Show Recording if recording, otherwise show what I am just playing */}
         <SheetMusic notes={isRecording || currentRecording.length > 0 ? currentRecording : realtimeNotes} />
      </div>

      <div className="piano-scroll-wrapper">
        <div className={`piano-keys ${!isLoaded ? 'disabled' : ''}`}>
           {/* === LOW OCTAVE (C3) === */}
           <div className="octave-group">
            <button className={getKeyClass("C3", "white")} onPointerDown={() => playNote("C3")}>C3 (Z)</button>
            <button className={getKeyClass("C#3", "black")} onPointerDown={() => playNote("C#3")}>(S)</button>
            <button className={getKeyClass("D3", "white")} onPointerDown={() => playNote("D3")}>D3 (X)</button>
            <button className={getKeyClass("D#3", "black")} onPointerDown={() => playNote("D#3")}>(D)</button>
            <button className={getKeyClass("E3", "white")} onPointerDown={() => playNote("E3")}>E3 (C)</button>
            <button className={getKeyClass("F3", "white")} onPointerDown={() => playNote("F3")}>F3 (V)</button>
            <button className={getKeyClass("F#3", "black")} onPointerDown={() => playNote("F#3")}>(G)</button>
            <button className={getKeyClass("G3", "white")} onPointerDown={() => playNote("G3")}>G3 (B)</button>
            <button className={getKeyClass("G#3", "black")} onPointerDown={() => playNote("G#3")}>(H)</button>
            <button className={getKeyClass("A3", "white")} onPointerDown={() => playNote("A3")}>A3 (N)</button>
            <button className={getKeyClass("A#3", "black")} onPointerDown={() => playNote("A#3")}>(J)</button>
            <button className={getKeyClass("B3", "white")} onPointerDown={() => playNote("B3")}>B3 (M)</button>
          </div>

          {/* === MIDDLE OCTAVE (C4) === */}
          <div className="octave-group">
            <button className={getKeyClass("C4", "white")} onPointerDown={() => playNote("C4")}>C4 (Q)</button>
            <button className={getKeyClass("C#4", "black")} onPointerDown={() => playNote("C#4")}>(2)</button>
            <button className={getKeyClass("D4", "white")} onPointerDown={() => playNote("D4")}>D4 (W)</button>
            <button className={getKeyClass("D#4", "black")} onPointerDown={() => playNote("D#4")}>(3)</button>
            <button className={getKeyClass("E4", "white")} onPointerDown={() => playNote("E4")}>E4 (E)</button>
            <button className={getKeyClass("F4", "white")} onPointerDown={() => playNote("F4")}>F4 (R)</button>
            <button className={getKeyClass("F#4", "black")} onPointerDown={() => playNote("F#4")}>(5)</button>
            <button className={getKeyClass("G4", "white")} onPointerDown={() => playNote("G4")}>G4 (T)</button>
            <button className={getKeyClass("G#4", "black")} onPointerDown={() => playNote("G#4")}>(6)</button>
            <button className={getKeyClass("A4", "white")} onPointerDown={() => playNote("A4")}>A4 (Y)</button>
            <button className={getKeyClass("A#4", "black")} onPointerDown={() => playNote("A#4")}>(7)</button>
            <button className={getKeyClass("B4", "white")} onPointerDown={() => playNote("B4")}>B4 (U)</button>
          </div>
          <button className={getKeyClass("C5", "white")} onPointerDown={() => playNote("C5")}>C5 (I)</button>
        </div>
      </div>

      <div className="controls">
        <button className={`record-btn ${sustain ? 'btn-green' : 'btn-grey'}`} onClick={() => setSustain(!sustain)}>
          {sustain ? "🦶 Sustain: ON" : "🦶 Sustain: OFF"}
        </button>
        {!isRecording ? (
          <button className="record-btn btn-red" onClick={startRecording} disabled={!isLoaded}>🔴 Rec</button>
        ) : (
          <button className="record-btn btn-red" onClick={stopRecording}>⏹ Stop</button>
        )}
        <button className="record-btn btn-purple" onClick={aiFinishSong} disabled={currentRecording.length === 0 || isRecording || !aiLoaded}>
           ✨ AI Finish
        </button>
        <button 
          className={`record-btn ${currentRecording.length > 0 && !isRecording ? 'btn-blue' : 'btn-disabled'}`} 
          onClick={openSaveModal} 
          disabled={currentRecording.length === 0 || isRecording}
        >
          💾 Save
        </button>
      </div>
      
      {currentRecording.length > 0 && !isRecording && (
         <div style={{marginTop: '10px'}}><button className="play-small-btn" onClick={() => playSong(currentRecording)}>▶ Play Full Song</button></div>
      )}

      {savedSongs.length > 0 && (
        <div className="song-library">
          <h3>🎵 My Songs</h3>
          <div className="song-list">
            {savedSongs.map((song) => (
              <div key={song.id} className="song-item">
                <div style={{display:'flex', flexDirection:'column'}}>
                  <span className="song-name">{song.name}</span>
                  <span className="song-info">{song.notes.length} notes</span>
                </div>
                <div style={{display:'flex', gap:'10px'}}>
                  <button className="play-small-btn" onClick={() => playSong(song.notes)}>▶</button>
                  <button className="delete-btn" onClick={() => setSongToDelete(song.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* --- CUSTOM SAVE MODAL --- */}
      {isSaveModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>💾 Name Your Song</h3>
            <input 
              type="text" 
              value={newSongName} 
              onChange={(e) => setNewSongName(e.target.value)} 
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && confirmSaveSong()}
            />
            <div className="modal-actions">
              <button className="btn-grey" onClick={cancelSave}>Cancel</button>
              <button className="btn-blue" onClick={confirmSaveSong}>Save Song</button>
            </div>
          </div>
        </div>
      )}
      {/* --- CUSTOM DELETE MODAL --- */}
      {songToDelete && (
        <div className="modal-overlay">
          <div className="custom-modal">
            <h3>Delete Song?</h3>
            <p>Are you sure you want to delete this track? This cannot be undone.</p>
            <div className="modal-buttons">
              <button 
                className="cancel-btn" 
                onClick={() => setSongToDelete(null)}
              >
                Cancel
              </button>
              <button 
                className="confirm-delete-btn" 
                onClick={() => {
                  // 1. Filter out the song we want to delete
                  const updatedSongs = savedSongs.filter(song => song.id !== songToDelete);
                  
                  // 2. Update the React state so it disappears from the screen
                  setSavedSongs(updatedSongs);
                  
                  // 3. Update Local Storage so it stays deleted when you refresh
                  localStorage.setItem("piano_songs", JSON.stringify(updatedSongs));
                  
                  // 4. Close the modal
                  setSongToDelete(null); 
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Piano;