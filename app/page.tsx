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
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      {/* ── HERO ── */}
      <section className="hero-cinematic relative pb-36 sm:pb-40">
        {/* Background layers */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {/* Mesh gradient blobs */}
          <div className="absolute top-[-10%] left-[10%] w-[540px] h-[540px] rounded-full bg-violet-600/22 blur-[130px] animate-mesh" />
          <div className="absolute top-[20%] right-[5%] w-[420px] h-[420px] rounded-full bg-indigo-500/16 blur-[110px] animate-mesh" style={{ animationDelay: '-7s' }} />
          <div className="absolute bottom-[-5%] left-[30%] w-[620px] h-[420px] rounded-full bg-purple-500/12 blur-[150px] animate-mesh" style={{ animationDelay: '-14s' }} />

          {/* Neural network lines — very subtle */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.055]" preserveAspectRatio="none" aria-hidden="true">
            <line x1="8%"  y1="22%" x2="32%" y2="44%" stroke="white" strokeWidth="0.8" />
            <line x1="32%" y1="44%" x2="60%" y2="28%" stroke="white" strokeWidth="0.8" />
            <line x1="60%" y1="28%" x2="86%" y2="50%" stroke="white" strokeWidth="0.8" />
            <line x1="32%" y1="44%" x2="22%" y2="72%" stroke="white" strokeWidth="0.8" />
            <line x1="60%" y1="28%" x2="74%" y2="66%" stroke="white" strokeWidth="0.8" />
            <line x1="22%" y1="72%" x2="52%" y2="84%" stroke="white" strokeWidth="0.8" />
            <line x1="52%" y1="84%" x2="74%" y2="66%" stroke="white" strokeWidth="0.8" />
            <line x1="86%" y1="50%" x2="93%" y2="76%" stroke="white" strokeWidth="0.8" />
            <circle cx="8%"  cy="22%" r="2" fill="white" opacity="0.55" />
            <circle cx="32%" cy="44%" r="2" fill="white" opacity="0.55" />
            <circle cx="60%" cy="28%" r="2" fill="white" opacity="0.55" />
            <circle cx="86%" cy="50%" r="2" fill="white" opacity="0.55" />
            <circle cx="22%" cy="72%" r="2" fill="white" opacity="0.55" />
            <circle cx="74%" cy="66%" r="2" fill="white" opacity="0.55" />
            <circle cx="52%" cy="84%" r="2" fill="white" opacity="0.55" />
            <circle cx="93%" cy="76%" r="2" fill="white" opacity="0.55" />
          </svg>

          {/* Floating particles */}
          <div className="absolute top-[18%] left-[22%] w-1 h-1 rounded-full bg-violet-400/55 blur-[1px] animate-pulse-slow" />
          <div className="absolute top-[36%] right-[26%] w-1.5 h-1.5 rounded-full bg-indigo-300/45 blur-[1px] animate-pulse-slow" style={{ animationDelay: '-2s' }} />
          <div className="absolute top-[62%] left-[57%] w-1 h-1 rounded-full bg-purple-400/50 blur-[1px] animate-pulse-slow" style={{ animationDelay: '-4s' }} />
          <div className="absolute top-[27%] right-[17%] w-[3px] h-[3px] rounded-full bg-violet-300/65 animate-pulse-slow" style={{ animationDelay: '-1s' }} />
          <div className="absolute top-[72%] left-[14%] w-1 h-1 rounded-full bg-indigo-400/40 blur-[1px] animate-pulse-slow" style={{ animationDelay: '-3.5s' }} />
          <div className="absolute top-[48%] left-[48%] w-[3px] h-[3px] rounded-full bg-violet-300/40 animate-pulse-slow" style={{ animationDelay: '-2.5s' }} />

          {/* Grid overlay */}
          <div className="absolute inset-0 opacity-[0.045]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />

          {/* Edge vignette */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse 88% 80% at 50% 45%, transparent 28%, rgba(7, 3, 22, 0.62) 100%)',
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
          {/* Radial glow orb — breathes slowly */}
          <div
            className="absolute top-1/2 left-1/2 w-[760px] h-[420px] rounded-full pointer-events-none animate-orb-breathe"
            style={{ background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.20) 0%, rgba(109,40,217,0.08) 55%, transparent 78%)' }}
            aria-hidden="true"
          />

          {/* Heading */}
          <h1 className="relative font-display text-5xl sm:text-6xl lg:text-7xl font-normal tracking-[-0.02em] mb-7 animate-fade-in-up" style={{ lineHeight: '1.08' }}>
            <span className="text-white">Make AI Text</span>
            <br />
            <span className="gradient-text italic text-glow-violet">Sound Human</span>
            <span className="text-white/42"> —</span>
            <br />
            <span className="text-white/78">Instantly.</span>
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
      <footer className="mt-auto py-10 relative z-10">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-[11px] text-gray-400 tracking-wide">
            This tool improves writing style and naturalness. Always review output before use.
          </p>
        </div>
      </footer>

      {/* AI doodle texture — subtle bottom-right background layer */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/ai-doodle.svg"
        alt=""
        className="absolute pointer-events-none select-none"
        style={{
          bottom: '20px',
          right: '-40px',
          width: '720px',
          height: 'auto',
          zIndex: 1,
          opacity: 0.048,
          filter: 'blur(1px)',
        }}
        aria-hidden="true"
      />
    </div>
  );
}
