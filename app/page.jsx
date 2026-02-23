'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Line, Sprite } from '@react-three/drei'; // removed unused useTexture
import { createClient } from '@supabase/supabase-js';
import * as THREE from 'three';
import { fabric } from 'fabric';   // ✅ Correct named import
import { motion, AnimatePresence } from 'framer-motion';
import { HexColorPicker } from 'react-colorful';
import { 
  FiBrush, FiEraser, FiSquare, FiType, FiRotateCcw, FiRotateCw,
  FiTrash2, FiSave, FiX, FiLayers, FiFilter, FiImage, FiDownload,
  FiUpload, FiZoomIn, FiZoomOut, FiMove, FiCircle, FiTriangle
} from 'react-icons/fi';
import { create } from 'zustand';

// ---------- Supabase ----------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ---------- Zustand Store ----------
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

// ---------- Advanced Drawing Panel ----------
function DrawingPanel() {
  const { isDrawingPanelOpen, currentLat, currentLng, setDrawingPanel, addLandmark } = useStore();
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const [color, setColor] = useState('#00ffc3');
  const [brushSize, setBrushSize] = useState(5);
  const [isErasing, setIsErasing] = useState(false);
  const [name, setName] = useState('');
  const [brushType, setBrushType] = useState('pencil'); // pencil, spray, calligraphic
  const [activeLayer, setActiveLayer] = useState(0);
  const [layers, setLayers] = useState([{ name: 'Layer 1', visible: true }]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [zoom, setZoom] = useState(1);
  const [filter, setFilter] = useState('none'); // none, blur, grayscale, etc.
  const [fontFamily, setFontFamily] = useState('Share Tech Mono');
  const [fontSize, setFontSize] = useState(30);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [gradient, setGradient] = useState(null); // { type, colors }

  // Initialize Fabric canvas with advanced features
  useEffect(() => {
    if (!isDrawingPanelOpen) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 600,
      height: 600,
      backgroundColor: '#1a1a1a',
      preserveObjectStacking: true,
      allowTouchScrolling: false,
    });

    // Add custom brushes
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = color;
    canvas.freeDrawingBrush.width = brushSize;

    // Add spray brush
    const sprayBrush = new fabric.SprayBrush(canvas);
    sprayBrush.color = color;
    sprayBrush.width = brushSize;
    sprayBrush.density = 20;
    canvas.sprayBrush = sprayBrush;

    // Add calligraphic brush (pattern)
    const patternBrush = new fabric.PatternBrush(canvas);
    patternBrush.color = color;
    patternBrush.width = brushSize;
    patternBrush.source = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="5" fill="black"/></svg>';
    canvas.patternBrush = patternBrush;

    fabricRef.current = canvas;

    // Initialize history
    const initialState = canvas.toJSON();
    setHistory([initialState]);
    setHistoryIndex(0);

    // Save state on change
    const saveHistory = () => {
      if (!fabricRef.current) return;
      const state = fabricRef.current.toJSON();
      setHistory(prev => [...prev.slice(0, historyIndex + 1), state]);
      setHistoryIndex(prev => prev + 1);
    };

    canvas.on('object:added', saveHistory);
    canvas.on('object:modified', saveHistory);
    canvas.on('object:removed', saveHistory);

    return () => {
      canvas.dispose();
    };
  }, [isDrawingPanelOpen]);

  // Update brush when settings change
  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    let brush;
    switch (brushType) {
      case 'spray': brush = canvas.sprayBrush; break;
      case 'calligraphic': brush = canvas.patternBrush; break;
      default: brush = canvas.freeDrawingBrush;
    }
    canvas.freeDrawingBrush = brush;
    brush.color = isErasing ? '#1a1a1a' : color;
    brush.width = brushSize;
    if (brushType === 'spray') brush.density = 20;
  }, [brushType, color, brushSize, isErasing]);

  // Undo/Redo
  const undo = () => {
    if (historyIndex <= 0 || !fabricRef.current) return;
    fabricRef.current.loadFromJSON(history[historyIndex - 1], () => {
      fabricRef.current.renderAll();
      setHistoryIndex(historyIndex - 1);
    });
  };

  const redo = () => {
    if (historyIndex >= history.length - 1 || !fabricRef.current) return;
    fabricRef.current.loadFromJSON(history[historyIndex + 1], () => {
      fabricRef.current.renderAll();
      setHistoryIndex(historyIndex + 1);
    });
  };

  // Apply filter to selected object
  const applyFilter = (filterType) => {
    if (!fabricRef.current) return;
    const activeObject = fabricRef.current.getActiveObject();
    if (!activeObject) {
      alert('Please select an object first.');
      return;
    }
    if (!activeObject.filters) activeObject.filters = [];
    activeObject.filters = []; // clear existing
    switch (filterType) {
      case 'blur':
        activeObject.filters.push(new fabric.Image.filters.Blur({ blur: 0.5 }));
        break;
      case 'grayscale':
        activeObject.filters.push(new fabric.Image.filters.Grayscale());
        break;
      case 'brightness':
        activeObject.filters.push(new fabric.Image.filters.Brightness({ brightness: 0.2 }));
        break;
      case 'contrast':
        activeObject.filters.push(new fabric.Image.filters.Contrast({ contrast: 0.3 }));
        break;
      default: break;
    }
    activeObject.applyFilters();
    fabricRef.current.renderAll();
  };

  // Add shape
  const addShape = (type) => {
    if (!fabricRef.current) return;
    let shape;
    switch (type) {
      case 'rect':
        shape = new fabric.Rect({
          left: 100, top: 100, width: 80, height: 60,
          fill: gradient ? new fabric.Gradient(gradient) : 'transparent',
          stroke: color, strokeWidth: 3,
        });
        break;
      case 'circle':
        shape = new fabric.Circle({
          left: 150, top: 150, radius: 40,
          fill: gradient ? new fabric.Gradient(gradient) : 'transparent',
          stroke: color, strokeWidth: 3,
        });
        break;
      case 'triangle':
        shape = new fabric.Triangle({
          left: 200, top: 200, width: 80, height: 80,
          fill: gradient ? new fabric.Gradient(gradient) : 'transparent',
          stroke: color, strokeWidth: 3,
        });
        break;
    }
    fabricRef.current.add(shape);
  };

  // Add text
  const addText = () => {
    if (!fabricRef.current) return;
    const text = new fabric.IText('LANDMARK', {
      left: 100, top: 100,
      fontFamily, fontSize,
      fill: color,
      fontWeight: isBold ? 'bold' : 'normal',
      fontStyle: isItalic ? 'italic' : 'normal',
      underline: isUnderline,
    });
    fabricRef.current.add(text);
  };

  // Import image
  const importImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (f) => {
      fabric.Image.fromURL(f.target.result, (img) => {
        img.set({ left: 100, top: 100, scaleX: 0.5, scaleY: 0.5 });
        fabricRef.current.add(img);
      });
    };
    reader.readAsDataURL(file);
  };

  // Save to Supabase
  const handleSave = async () => {
    if (!name.trim()) {
      alert('Enter a designation');
      return;
    }
    if (!fabricRef.current) return;
    
    const drawingData = fabricRef.current.toDataURL('png');
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
      
      addLandmark(data[0]);
      setDrawingPanel(false);
      setName('');
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
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-[95vw] max-w-6xl bg-black/95 border-2 border-neon-pink shadow-[0_0_40px_#ff00c1] p-6 rounded-2xl z-50 backdrop-blur-lg"
        >
          <h3 className="text-center text-neon-pink text-3xl mb-4 tracking-widest animate-pulse">
            ⚡ ADVANCED LANDMARK FORGE ⚡
          </h3>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Canvas Area with Zoom Controls */}
            <div className="flex-1 relative">
              <div className="absolute top-2 right-2 z-10 flex gap-2">
                <button onClick={() => setZoom(z => Math.min(z + 0.1, 3))} className="p-2 bg-black border border-neon-cyan text-neon-cyan">
                  <FiZoomIn />
                </button>
                <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} className="p-2 bg-black border border-neon-cyan text-neon-cyan">
                  <FiZoomOut />
                </button>
              </div>
              <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                <canvas
                  ref={canvasRef}
                  className="border-2 border-neon-cyan rounded-lg"
                  style={{ width: 600, height: 600 }}
                />
              </div>
            </div>

            {/* Tools Panel (scrollable) */}
            <div className="w-80 space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {/* Name Input */}
              <input
                type="text"
                placeholder="ENTER DESIGNATION"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black border border-neon-pink text-neon-pink p-2 font-mono"
                maxLength={30}
              />

              {/* Brush / Eraser */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsErasing(false)}
                  className={`p-2 border ${!isErasing ? 'border-neon-cyan text-neon-cyan' : 'border-gray-600 text-gray-500'}`}
                ><FiBrush /> Brush</button>
                <button
                  onClick={() => setIsErasing(true)}
                  className={`p-2 border ${isErasing ? 'border-neon-pink text-neon-pink' : 'border-gray-600 text-gray-500'}`}
                ><FiEraser /> Eraser</button>
              </div>

              {/* Brush Type */}
              <div>
                <label className="block text-neon-cyan mb-1">Brush Type</label>
                <select
                  value={brushType}
                  onChange={(e) => setBrushType(e.target.value)}
                  className="w-full bg-black border border-neon-cyan text-neon-cyan p-2"
                >
                  <option value="pencil">Pencil</option>
                  <option value="spray">Spray</option>
                  <option value="calligraphic">Calligraphic</option>
                </select>
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-neon-cyan mb-1">Color</label>
                <HexColorPicker color={color} onChange={setColor} />
              </div>

              {/* Brush Size */}
              <div>
                <label className="block text-neon-cyan mb-1">Size: {brushSize}</label>
                <input
                  type="range" min="1" max="50"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Undo/Redo */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={undo} className="p-2 border border-neon-cyan text-neon-cyan">
                  <FiRotateCcw /> Undo
                </button>
                <button onClick={redo} className="p-2 border border-neon-cyan text-neon-cyan">
                  <FiRotateCw /> Redo
                </button>
              </div>

              {/* Shapes */}
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => addShape('rect')} className="p-2 border border-neon-pink text-neon-pink">
                  <FiSquare /> Rect
                </button>
                <button onClick={() => addShape('circle')} className="p-2 border border-neon-pink text-neon-pink">
                  <FiCircle /> Circle
                </button>
                <button onClick={() => addShape('triangle')} className="p-2 border border-neon-pink text-neon-pink">
                  <FiTriangle /> Triangle
                </button>
              </div>

              {/* Text Controls */}
              <div>
                <label className="block text-neon-cyan mb-1">Text</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    placeholder="Font"
                    className="flex-1 bg-black border border-neon-pink text-neon-pink p-1"
                  />
                  <input
                    type="number"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-16 bg-black border border-neon-pink text-neon-pink p-1"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setIsBold(!isBold)} className={`p-1 border ${isBold ? 'border-neon-cyan text-neon-cyan' : 'border-gray-600 text-gray-500'}`}>B</button>
                  <button onClick={() => setIsItalic(!isItalic)} className={`p-1 border ${isItalic ? 'border-neon-cyan text-neon-cyan' : 'border-gray-600 text-gray-500'}`}>I</button>
                  <button onClick={() => setIsUnderline(!isUnderline)} className={`p-1 border ${isUnderline ? 'border-neon-cyan text-neon-cyan' : 'border-gray-600 text-gray-500'}`}>U</button>
                  <button onClick={addText} className="p-1 border border-neon-pink text-neon-pink"><FiType /> Add</button>
                </div>
              </div>

              {/* Filters */}
              <div>
                <label className="block text-neon-cyan mb-1">Filter (on selected)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => applyFilter('blur')} className="p-1 border border-neon-cyan text-neon-cyan">Blur</button>
                  <button onClick={() => applyFilter('grayscale')} className="p-1 border border-neon-cyan text-neon-cyan">Grayscale</button>
                  <button onClick={() => applyFilter('brightness')} className="p-1 border border-neon-cyan text-neon-cyan">Brightness</button>
                  <button onClick={() => applyFilter('contrast')} className="p-1 border border-neon-cyan text-neon-cyan">Contrast</button>
                </div>
              </div>

              {/* Import Image */}
              <div>
                <label className="block text-neon-cyan mb-1">Import Image</label>
                <input type="file" accept="image/*" onChange={importImage} className="w-full text-neon-cyan" />
              </div>

              {/* Clear Canvas */}
              <button onClick={() => fabricRef.current?.clear()} className="w-full p-2 border border-neon-pink text-neon-pink">
                <FiTrash2 /> Clear All
              </button>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-4">
                <button
                  onClick={handleSave}
                  className="p-3 bg-neon-cyan text-black font-bold border-2 border-neon-cyan hover:shadow-[0_0_20px_#00ffc3] transition"
                >
                  <FiSave /> SAVE
                </button>
                <button
                  onClick={() => setDrawingPanel(false)}
                  className="p-3 border-2 border-neon-pink text-neon-pink hover:shadow-[0_0_20px_#ff00c1] transition"
                >
                  <FiX /> CANCEL
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

// ---------- 3D Earth with Particles ----------
function Earth() {
  const { setDrawingPanel } = useStore();
  const particlesRef = useRef();

  useFrame(() => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y += 0.0002;
    }
  });

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
    <group>
      {/* Base sphere */}
      <Sphere args={[5, 64, 32]} onClick={handleClick}>
        <meshPhongMaterial color="#112222" emissive="#002222" shininess={30} transparent opacity={0.9} />
      </Sphere>

      {/* Wireframe */}
      <Sphere args={[5.02, 32, 16]}>
        <meshBasicMaterial color="#00ffc3" wireframe transparent opacity={0.15} />
      </Sphere>

      {/* Grid lines */}
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
        return <Line key={`lon-${lon}`} points={points} color="#00ffc3" lineWidth={0.5} />;
      })}

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
        return <Line key={`lat-${lat}`} points={points} color="#00ffc3" lineWidth={0.5} />;
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

      {/* Floating particles (robotic dust) */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={800}
            array={new Float32Array(Array.from({ length: 2400 }, () => {
              const r = 5 + 0.8 + Math.random() * 1.5;
              const theta = Math.random() * Math.PI * 2;
              const phi = Math.acos(2 * Math.random() - 1);
              return [
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
              ];
            }).flat())}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#00ffc3" size={0.03} transparent />
      </points>
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

        // Create a canvas texture from base64
        const img = new Image();
        img.src = drawing_data;
        const texture = new THREE.CanvasTexture(img);
        texture.needsUpdate = true;

        return (
          <Sprite key={id} position={position} scale={[1.5, 1.5, 1]}>
            <spriteMaterial map={texture} depthTest={false} />
          </Sprite>
        );
      })}
    </group>
  );
}

// ---------- Main Page ----------
export default function Home() {
  const { setLandmarks, landmarks } = useStore();

  useEffect(() => {
    const fetchLandmarks = async () => {
      const { data, error } = await supabase.from('landmarks').select('*');
      if (!error && data) setLandmarks(data);
    };
    fetchLandmarks();

    // Real-time subscription
    const subscription = supabase
      .channel('landmarks')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'landmarks' }, payload => {
        setLandmarks(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => subscription.unsubscribe();
  }, [setLandmarks]);

  return (
    <main className="w-screen h-screen relative overflow-hidden">
      <div className="absolute top-5 left-5 z-10 bg-black/80 border border-neon-cyan shadow-[0_0_20px_#00ffc3] px-6 py-3 backdrop-blur">
        <h1 className="text-neon-cyan tracking-widest text-xl">🌍 MAP EARTH // ROBOTIC LANDMARKS</h1>
      </div>

      <div className="absolute top-5 right-5 z-10 bg-black/80 border border-neon-pink shadow-[0_0_20px_#ff00c1] px-6 py-3 backdrop-blur">
        <span className="text-neon-pink">
          LAT: {useStore.getState().currentLat?.toFixed(2) || '--'}° LONG: {useStore.getState().currentLng?.toFixed(2) || '--'}°
        </span>
      </div>

      <div className="absolute bottom-5 right-5 z-10 text-neon-pink text-sm bg-black/50 px-3 py-1 rounded">
        SYSTEM: {landmarks.length} LANDMARKS ONLINE
      </div>

      <Canvas
        camera={{ position: [0, 2, 15], fov: 45 }}
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
          enableTouch
        />
        
        <Earth />
        <Landmarks />
      </Canvas>

      <DrawingPanel />
    </main>
  );
}
