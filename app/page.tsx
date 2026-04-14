'use client';

import { useState, useCallback } from 'react';
import { HumanizerSettings, HumanizerResult, DetectionReport as DetectionReportType, PipelineStep } from '@/types';
import { humanizeText } from '@/lib/humanizer';
import { detectAIPatterns } from '@/lib/detector';
import InputPanel from '@/components/InputPanel';
import OutputPanel from '@/components/OutputPanel';
import DetectionReport from '@/components/DetectionReport';
import SettingsBar from '@/components/SettingsBar';
import ProgressSteps from '@/components/ProgressSteps';

const PIPELINE_LABELS = [
  'Removing artifacts',
  'Replacing vocabulary',
  'Applying synonyms',
  'Fixing formatting',
  'Fixing language patterns',
  'Removing preambles',
  'Fixing morphology',
  'Diversifying n-grams',
  'Diversifying starters',
  'Restructuring sentences',
  'Engineering burstiness',
  'Injecting variety',
  'Adding natural flow',
  'Diversifying punctuation',
  'Cleaning adverbs',
  'Validating semantics',
  'Checking naturalness',
  'Fixing integrity',
  'Refining tone',
  'Injecting imperfections',
];

function createSteps(): PipelineStep[] {
  return PIPELINE_LABELS.map((label, i) => ({
    id: i,
    label,
    status: 'pending' as const,
  }));
}

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [settings, setSettings] = useState<HumanizerSettings>({
    imperfectionLevel: 'moderate',
    burstinessMode: 'strong',
    randomSpacingEnabled: true,
    randomSpacingIntensity: 'medium',
    professionalMode: false,
  });
  const [detectionReport, setDetectionReport] = useState<DetectionReportType | null>(null);
  const [humanizerResult, setHumanizerResult] = useState<HumanizerResult | null>(null);
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(createSteps());
  const [isProcessing, setIsProcessing] = useState(false);

  const handleScan = useCallback(() => {
    if (!inputText.trim()) return;
    const report = detectAIPatterns(inputText);
    setDetectionReport(report);
  }, [inputText]);

  const handleHumanize = useCallback(async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    const steps = createSteps();
    setPipelineSteps(steps);
    const report = detectAIPatterns(inputText);
    setDetectionReport(report);

    try {
      const result = await humanizeText(inputText, settings, (stepIndex) => {
        setPipelineSteps(prev =>
          prev.map((step, i) => ({
            ...step,
            status: i < stepIndex ? 'complete' : i === stepIndex ? 'active' : 'pending',
          }))
        );
      });
      setPipelineSteps(prev => prev.map(s => ({ ...s, status: 'complete' as const })));
      setHumanizerResult(result);
      const outputReport = detectAIPatterns(result.finalText);
      setDetectionReport(outputReport);
    } catch (error) {
      console.error('Humanization failed:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, settings]);

  const handleClear = useCallback(() => {
    setInputText('');
    setDetectionReport(null);
    setHumanizerResult(null);
    setPipelineSteps(createSteps());
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── HERO ── */}
      <section className="hero-cinematic relative pb-36 sm:pb-40">
        {/* Mesh gradient blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-violet-600/20 blur-[120px] animate-mesh" />
          <div className="absolute top-[20%] right-[5%] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px] animate-mesh" style={{ animationDelay: '-7s' }} />
          <div className="absolute bottom-[-5%] left-[30%] w-[600px] h-[400px] rounded-full bg-purple-500/10 blur-[140px] animate-mesh" style={{ animationDelay: '-14s' }} />
          {/* Grid overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
        </div>

        {/* Nav */}
        <nav className="relative z-10 max-w-6xl mx-auto px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-white font-semibold text-base tracking-tight">HumanizeAI</span>
              <span className="text-[9px] font-medium text-violet-300/60 bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/[0.08] uppercase tracking-widest">
                Beta
              </span>
            </div>
            <button
              onClick={() => document.getElementById('tool-card')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-xs font-medium text-white/60 hover:text-white/90 bg-white/[0.06] hover:bg-white/[0.1] px-4 py-2 rounded-full border border-white/[0.08] transition-all duration-300"
            >
              Get Started
            </button>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-16 sm:pt-20 text-center">
          {/* Radial glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-violet-500/[0.08] rounded-full blur-[100px] pointer-events-none" aria-hidden="true" />

          {/* Heading */}
          <h1 className="relative font-display text-5xl sm:text-6xl lg:text-7xl font-normal tracking-[-0.02em] mb-7 animate-fade-in-up" style={{ lineHeight: '1.05' }}>
            <span className="text-white/90">Make AI Text</span>
            <br />
            <span className="gradient-text italic">Sound Human</span>
            <span className="text-white/50"> —</span>
            <br />
            <span className="text-white/70">Instantly.</span>
          </h1>

          {/* Subheading */}
          <p className="relative text-sm sm:text-base text-white/40 max-w-md mx-auto mb-10 tracking-wide animate-fade-in-up" style={{ animationDelay: '0.15s', lineHeight: '1.8' }}>
            Transform AI-generated text into natural, human-sounding writing in seconds.
          </p>

          {/* CTA */}
          <div className="relative animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <button
              onClick={() => document.getElementById('tool-card')?.scrollIntoView({ behavior: 'smooth' })}
              className="btn-cta inline-flex items-center gap-2.5 px-8 py-3.5 text-sm font-semibold rounded-full"
            >
              Start Humanizing
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ── TOOL SECTION — overlaps hero ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pb-16 sm:px-6 -mt-24 sm:-mt-28 relative z-20">
        <div id="tool-card" className="glass-card rounded-[24px] p-6 sm:p-8 lg:p-10 space-y-8">
          <SettingsBar
            settings={settings}
            onSettingsChange={setSettings}
            onHumanize={handleHumanize}
            onClear={handleClear}
            isProcessing={isProcessing}
            hasInput={!!inputText.trim()}
          />

          <ProgressSteps steps={pipelineSteps} visible={isProcessing || humanizerResult !== null} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <InputPanel
              text={inputText}
              onTextChange={setInputText}
              onScan={handleScan}
              isProcessing={isProcessing}
            />
            <OutputPanel
              originalText={inputText}
              outputText={humanizerResult?.finalText || ''}
            />
          </div>

          <DetectionReport report={detectionReport} />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-10">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-[11px] text-gray-400 tracking-wide">
            This tool improves writing style and naturalness. Always review output before use.
          </p>
        </div>
      </footer>
    </div>
  );
}
