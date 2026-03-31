import React, { useEffect, useRef } from 'react';
// FIX: Import tools directly instead of using 'Vex.Flow'
import { Renderer, Stave, StaveNote, Accidental, Formatter, Voice, Annotation } from 'vexflow';

const SheetMusic = ({ notes }) => {
  const containerRef = useRef();

  useEffect(() => {
    // 1. If no notes, do nothing
    if (!notes || notes.length === 0) {
      containerRef.current.innerHTML = '<div style="color:#aaa; padding:20px;">Play notes to see sheet music...</div>';
      return;
    }

    // 2. Clear previous drawing
    containerRef.current.innerHTML = '';
    
    // 3. Setup VexFlow Renderer
    const width = Math.max(600, notes.length * 50); 
    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    renderer.resize(width, 200);
    
    const context = renderer.getContext();
    
    // 4. Create the Stave (The 5 lines)
    const stave = new Stave(10, 40, width - 20);
    stave.addClef("treble").addTimeSignature("4/4");
    stave.setContext(context).draw();

    // 5. Convert your played notes into VexFlow format
    const vexNotes = notes.map(n => {
      // Logic to convert "C#4" -> "c#/4"
      const keys = [n.note.replace('#', 'b').toLowerCase().replace(/(\w)(\d)/, '$1/$2')];
      
      const note = new StaveNote({ keys: keys, duration: "q" });
      
      // Add # or b if needed
      if (n.note.includes('#')) {
        note.addModifier(new Accidental("#"), 0);
      } else if (n.note.includes('b')) {
        note.addModifier(new Accidental("b"), 0);
      }

      // --- ADD NOTE NAMES (The Blue Line Feature) ---
      // This puts "C4", "D4" etc. below the note
      note.addModifier(new Annotation(n.note)
        .setFont("Arial", 12, "bold")
        .setVerticalJustification(Annotation.VerticalJustify.BOTTOM), 0);
      // ----------------------------------------

      return note;
    });

    // 6. Draw the notes
    try {
        const voice = new Voice({ num_beats: vexNotes.length, beat_value: 4 });
        
        // Disable strict timing so we can just show the notes as a list
        voice.setStrict(false); 
        voice.addTickables(vexNotes);

        new Formatter().joinVoices([voice]).format([voice], width - 50);
        voice.draw(context, stave);
    } catch (e) {
        console.error("VexFlow Error:", e);
    }

  }, [notes]);

  return (
    <div 
      ref={containerRef} 
      className="sheet-music-paper" 
      style={{ overflowX: 'auto', background: 'white', borderRadius: '10px', padding: '10px' }} 
    />
  );
};

export default SheetMusic;