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
      {/* ── Hero Section ── */}
      <section className="hero-gradient relative pb-28 sm:pb-32">
        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-14 sm:px-6 text-center">
          {/* Brand */}
          <div className="inline-flex items-center gap-2.5 mb-7 animate-fade-in">
            <span className="text-white font-bold text-lg tracking-tight">HumanizeAI</span>
            <span className="text-[10px] font-medium text-white/60 bg-white/10 px-2.5 py-1 rounded-full border border-white/15 backdrop-blur-sm">
              Pure Algorithmic
            </span>
          </div>

          {/* Radial glow behind heading */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
              <div className="w-[600px] h-[250px] bg-white/10 rounded-full blur-[80px]" />
            </div>

            {/* Main heading */}
            <h1 className="relative text-4xl sm:text-5xl lg:text-[3.75rem] font-extrabold text-white tracking-[-0.025em] mb-5 animate-fade-in-up" style={{ lineHeight: '1.1' }}>
              Make AI Text Sound Human
              <br />
              <span className="text-white/70">— Instantly</span>
            </h1>
          </div>

          {/* Subheading */}
          <p className="text-base sm:text-lg text-white/60 max-w-lg mx-auto mb-9 font-normal animate-fade-in-up" style={{ animationDelay: '0.1s', lineHeight: '1.75' }}>
            Transform AI-generated text into natural, human-sounding writing in seconds.
          </p>

          {/* CTA Button */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <button
              onClick={() => document.getElementById('tool-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="cta-glow inline-flex items-center gap-2.5 px-9 py-4 text-sm font-bold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Humanize Text
            </button>
          </div>
        </div>

        {/* Decorative blurred blobs */}
        <div className="absolute top-8 left-[3%] w-80 h-80 bg-purple-500/20 rounded-full blur-[100px] animate-pulse-slow" />
        <div className="absolute bottom-12 right-[5%] w-96 h-96 bg-indigo-400/15 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2.5s' }} />
        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-white/[0.04] rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-[20%] w-64 h-64 bg-pink-400/10 rounded-full blur-[80px] animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
      </section>

      {/* ── Main Tool Section — overlaps hero ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 pb-12 sm:px-6 -mt-20 sm:-mt-24 relative z-20">
        {/* Ambient glow behind card */}
        <div className="absolute inset-x-0 -top-10 flex justify-center pointer-events-none" aria-hidden="true">
          <div className="w-[800px] h-[250px] bg-indigo-400/10 rounded-full blur-[100px]" />
        </div>

        {/* Floating Glass Card */}
        <div id="tool-card" className="glass-card-strong rounded-3xl p-6 sm:p-8 lg:p-10 space-y-8 relative">
          {/* Control Bar */}
          <SettingsBar
            settings={settings}
            onSettingsChange={setSettings}
            onHumanize={handleHumanize}
            onClear={handleClear}
            isProcessing={isProcessing}
            hasInput={!!inputText.trim()}
          />

          {/* Processing Details — collapsible */}
          <ProgressSteps steps={pipelineSteps} visible={isProcessing || humanizerResult !== null} />

          {/* Two-column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

          {/* Detection Report — collapsible */}
          <DetectionReport report={detectionReport} />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-gray-400">
            This tool improves writing style and naturalness. Always review output before use.
          </p>
        </div>
      </footer>
    </div>
  );
}
