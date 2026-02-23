'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sphere, Line, Sprite, useTexture } from '@react-three/drei';
import { createClient } from '@supabase/supabase-js';
import { fabric } from 'fabric';
import { motion, AnimatePresence } from 'framer-motion';
import { HexColorPicker } from 'react-colorful';
import { 
  FiBrush, FiEraser, FiSquare, FiType, FiImage, 
  FiLayers, FiRotateCcw, FiRotateCw, FiTrash2, FiSave, FiX 
} from 'react-icons/fi';
import { create } from 'zustand';

// ---------- Supabase ----------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ---------- Zustand Store (Drawing State) ----------
const useStore = create((set) => ({
  isDrawingPanelOpen: false,
  currentLat: 0,
  currentLng: 0,
  landmarks: [],
  setDrawingPanel: (open, lat = 0, lng = 0) => 
    set({ isDrawingPanelOpen: open, currentLat: lat, currentLng: lng }),
  setLandmarks: (landmarks) => set({ landmarks }),
  addLandmark: (landmark) => set((state) => ({ 
    landmarks: [...state.landmarks, landmark] 
  })),
}));

// ---------- 3D Earth Component (Robotic Aesthetic) ----------
function Earth() {
  const earthRef = useRef();
  const { setDrawingPanel } = useStore();

  // Click handler: convert screen to lat/lng
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    const { point } = e;
    const x = point.x, y = point.y, z = point.z;
    const r = Math.sqrt(x*x + y*y + z*z);
    const lat = 90 - (Math.acos(y / r) * 180 / Math.PI);
    let lng = (Math.atan2(z, x) * 180 / Math.PI) % 360;
    if (lng < -180) lng += 360;
    if (lng > 180) lng -= 360;
    setDrawingPanel(true, lat, lng);
  }, [setDrawingPanel]);

  return (
    <group ref={earthRef}>
      {/* Base sphere with emissive glow */}
      <Sphere args={[5, 64, 32]} onClick={handleClick}>
        <meshPhongMaterial 
          color="#112222" 
          emissive="#002222" 
          shininess={30} 
          transparent 
          opacity={0.9} 
        />
      </Sphere>

      {/* Glowing wireframe overlay */}
      <Sphere args={[5.02, 32, 16]}>
        <meshBasicMaterial color="#00ffc3" wireframe transparent opacity={0.15} />
      </Sphere>

      {/* Longitude lines (every 30°) */}
      {Array.from({ length: 12 }).map((_, i) => {
        const lon = i * 30;
        const points = [];
        for (let lat = -80; lat <= 80; lat += 5) {
          const phi = (90 - lat) * Math.PI / 180;
          const theta = lon * Math.PI / 180;
          const x = 5 * Math.sin(phi) * Math.cos(theta);
          const y = 5 * Math.cos(phi);
          const z = 5 * Math.sin(phi) * Math.sin(theta);
          points.push([x, y, z]);
        }
        return (
          <Line key={`lon-${lon}`} points={points} color="#00ffc3" lineWidth={0.5} />
        );
      })}

      {/* Latitude lines (every 30°) */}
      {Array.from({ length: 5 }).map((_, j) => {
        const lat = -60 + j * 30;
        const phi = (90 - lat) * Math.PI / 180;
        const points = [];
        for (let lon = 0; lon <= 360; lon += 5) {
          const theta = lon * Math.PI / 180;
          const x = 5 * Math.sin(phi) * Math.cos(theta);
          const y = 5 * Math.cos(phi);
          const z = 5 * Math.sin(phi) * Math.sin(theta);
          points.push([x, y, z]);
        }
        return (
          <Line key={`lat-${lat}`} points={points} color="#00ffc3" lineWidth={0.5} />
        );
      })}

      {/* Polar rings */}
      <Line 
        points={Array.from({ length: 73 }).map((_, k) => {
          const theta = k * 5 * Math.PI / 180;
          return [5 * Math.cos(theta), 0, 5 * Math.sin(theta)];
        })} 
        color="#ff00c1" 
        lineWidth={1} 
      />
    </group>
  );
}

// ---------- Landmark Sprites ----------
function Landmarks() {
  const { landmarks } = useStore();
  return (
    <group>
      {landmarks.map((lm) => {
        const { lat, lng, drawing_data, id } = lm;
        const phi = (90 - lat) * Math.PI / 180;
        const theta = lng * Math.PI / 180;
        const r = 5.15;
        const position = [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta)
        ];
        return (
          <Sprite key={id} position={position} scale={[1.5, 1.5, 1]}>
            <spriteMaterial>
              <primitive object={new THREE.CanvasTexture(
                (() => {
                  const img = new Image();
                  img.src = drawing_data;
                  return img;
                })()
              )} attach="map" />
            </spriteMaterial>
          </Sprite>
        );
      })}
    </group>
  );
}

// ---------- Advanced Drawing Panel (Fabric.js) ----------
function DrawingPanel() {
  const { isDrawingPanelOpen, currentLat, currentLng, setDrawingPanel, addLandmark } = useStore();
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [color, setColor] = useState('#00ffc3');
  const [brushSize, setBrushSize] = useState(5);
  const [isErasing, setIsErasing] = useState(false);
  const [name, setName] = useState('');

  // Initialize Fabric canvas
  useEffect(() => {
    if (!isDrawingPanelOpen) return;
    
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 512,
      height: 512,
      backgroundColor: '#1a1a1a',
      preserveObjectStacking: true,
    });
    
    // Add default brush
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = brushSize;
    canvas.isDrawingMode = true;
    
    fabricCanvasRef.current = canvas;

    // Load any saved drawing? Not yet.

    return () => {
      canvas.dispose();
    };
  }, [isDrawingPanelOpen]);

  // Update brush when settings change
  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    if (isErasing) {
      canvas.freeDrawingBrush.color = '#1a1a1a';
    } else {
      canvas.freeDrawingBrush.color = color;
    }
    canvas.freeDrawingBrush.width = brushSize;
  }, [color, brushSize, isErasing]);

  // Clear canvas
  const handleClear = () => {
    if (!fabricCanvasRef.current) return;
    fabricCanvasRef.current.clear();
    fabricCanvasRef.current.backgroundColor = '#1a1a1a';
    fabricCanvasRef.current.renderAll();
  };

  // Undo / Redo (simple stack)
  const handleUndo = () => {
    // For production, you'd implement a history stack. Here just a placeholder.
    alert('Undo not fully implemented in this demo');
  };

  const handleRedo = () => { alert('Redo not fully implemented'); };

  // Add text
  const handleAddText = () => {
    if (!fabricCanvasRef.current) return;
    const text = new fabric.IText('LANDMARK', {
      left: 100,
      top: 100,
      fontFamily: 'Share Tech Mono',
      fill: color,
      fontSize: 30,
    });
    fabricCanvasRef.current.add(text);
  };

  // Add rectangle
  const handleAddRect = () => {
    if (!fabricCanvasRef.current) return;
    const rect = new fabric.Rect({
      left: 150,
      top: 150,
      width: 80,
      height: 60,
      fill: 'transparent',
      stroke: color,
      strokeWidth: 3,
    });
    fabricCanvasRef.current.add(rect);
  };

  // Save to Supabase
  const handleSave = async () => {
    if (!name.trim()) {
      alert('Enter a designation');
      return;
    }
    if (!fabricCanvasRef.current) return;
    
    // Export as base64 PNG
    const drawingData = fabricCanvasRef.current.toDataURL('png');
    
    const payload = {
      name,
      lat: currentLat,
      lng: currentLng,
      drawing_data: drawingData,
    };

    try {
      const { data, error } = await supabase
        .from('landmarks')
        .insert([payload])
        .select();
      if (error) throw error;
      
      // Add to local state
      addLandmark(data[0]);
      
      // Close panel and reset
      setDrawingPanel(false);
      setName('');
      handleClear();
    } catch (err) {
      console.error('Save failed', err);
      alert('Save failed: ' + err.message);
    }
  };

  return (
    <AnimatePresence>
      {isDrawingPanelOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-[90vw] max-w-4xl bg-black/90 border-2 border-neon-pink shadow-[0_0_30px_#ff00c1] p-6 rounded-xl z-50 backdrop-blur"
        >
          <h3 className="text-center text-neon-pink text-2xl mb-4 tracking-widest">
            ⚡ DESIGN YOUR LANDMARK ⚡
          </h3>
          
          <div className="flex flex-col md:flex-row gap-6">
            {/* Canvas */}
            <div className="flex-1 flex justify-center">
              <canvas
                ref={canvasRef}
                className="border-2 border-neon-cyan rounded-lg"
                style={{ width: 512, height: 512 }}
              />
            </div>

            {/* Tools */}
            <div className="w-64 space-y-4">
              <input
                type="text"
                placeholder="ENTER DESIGNATION"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black border border-neon-pink text-neon-pink p-2 font-mono"
                maxLength={30}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setIsErasing(false)}
                  className={`flex-1 p-2 border ${!isErasing ? 'border-neon-cyan text-neon-cyan' : 'border-gray-600 text-gray-500'}`}
                >
                  <FiBrush className="inline mr-1" /> Brush
                </button>
                <button
                  onClick={() => setIsErasing(true)}
                  className={`flex-1 p-2 border ${isErasing ? 'border-neon-pink text-neon-pink' : 'border-gray-600 text-gray-500'}`}
                >
                  <FiEraser className="inline mr-1" /> Eraser
                </button>
              </div>

              <div>
                <label className="block text-neon-cyan mb-1">Color</label>
                <HexColorPicker color={color} onChange={setColor} />
              </div>

              <div>
                <label className="block text-neon-cyan mb-1">Brush Size: {brushSize}</label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="flex gap-2">
                <button onClick={handleUndo} className="p-2 border border-neon-cyan text-neon-cyan flex-1">
                  <FiRotateCcw className="inline" /> Undo
                </button>
                <button onClick={handleRedo} className="p-2 border border-neon-cyan text-neon-cyan flex-1">
                  <FiRotateCw className="inline" /> Redo
                </button>
              </div>

              <div className="flex gap-2">
                <button onClick={handleAddText} className="p-2 border border-neon-pink text-neon-pink flex-1">
                  <FiType className="inline" /> Text
                </button>
                <button onClick={handleAddRect} className="p-2 border border-neon-pink text-neon-pink flex-1">
                  <FiSquare className="inline" /> Rect
                </button>
              </div>

              <button onClick={handleClear} className="w-full p-2 border border-neon-pink text-neon-pink">
                <FiTrash2 className="inline mr-2" /> Clear Canvas
              </button>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleSave}
                  className="flex-1 p-3 bg-neon-cyan text-black font-bold border-2 border-neon-cyan hover:shadow-[0_0_15px_#00ffc3] transition"
                >
                  <FiSave className="inline mr-2" /> SAVE
                </button>
                <button
                  onClick={() => setDrawingPanel(false)}
                  className="flex-1 p-3 border-2 border-neon-pink text-neon-pink hover:shadow-[0_0_15px_#ff00c1] transition"
                >
                  <FiX className="inline mr-2" /> CANCEL
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center text-neon-cyan">
            Placing at LAT: {currentLat.toFixed(2)}° LNG: {currentLng.toFixed(2)}°
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Main Page ----------
export default function Home() {
  const { setLandmarks, landmarks } = useStore();

  // Load existing landmarks on mount
  useEffect(() => {
    const fetchLandmarks = async () => {
      const { data, error } = await supabase.from('landmarks').select('*');
      if (!error && data) setLandmarks(data);
    };
    fetchLandmarks();
  }, [setLandmarks]);

  return (
    <main className="w-screen h-screen relative">
      {/* Header */}
      <div className="absolute top-5 left-5 z-10 bg-black/80 border border-neon-cyan shadow-[0_0_20px_#00ffc3] px-6 py-3 backdrop-blur">
        <h1 className="text-neon-cyan tracking-widest">🌍 MAP EARTH // ROBOTIC LANDMARKS</h1>
      </div>

      {/* Coordinates display */}
      <div className="absolute top-5 right-5 z-10 bg-black/80 border border-neon-pink shadow-[0_0_20px_#ff00c1] px-6 py-3 backdrop-blur">
        <span className="text-neon-pink">
          LAT: {useStore.getState().currentLat?.toFixed(2) || '--'}° LONG: {useStore.getState().currentLng?.toFixed(2) || '--'}°
        </span>
      </div>

      {/* Status */}
      <div className="absolute bottom-5 right-5 z-10 text-neon-pink text-xs">
        SYSTEM: {landmarks.length} LANDMARKS ONLINE
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 2, 15], fov: 45 }}
        shadows={false}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color(0x050a0a);
        }}
      >
        <ambientLight intensity={0.4} color="#404060" />
        <directionalLight position={[1, 2, 1]} intensity={1} />
        <pointLight position={[5, 5, 5]} intensity={0.5} color="#00ffc3" />
        <pointLight position={[-5, -2, 5]} intensity={0.5} color="#ff00c1" />
        
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05} 
          autoRotate 
          autoRotateSpeed={0.5}
          maxPolarAngle={Math.PI / 2}
        />
        
        <Earth />
        <Landmarks />
      </Canvas>

      {/* Drawing Panel */}
      <DrawingPanel />
    </main>
  );
}
