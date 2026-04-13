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
      {/* Hero Section */}
      <section className="hero-gradient relative">
        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-16 pb-20 sm:px-6 text-center">
          {/* Brand */}
          <div className="inline-flex items-center gap-2 mb-8 animate-fade-in">
            <span className="text-white/90 font-bold text-lg tracking-tight">HumanizeAI</span>
            <span className="text-[10px] font-medium text-white/60 bg-white/15 px-2.5 py-1 rounded-full backdrop-blur-sm">
              Pure Algorithmic
            </span>
          </div>

          {/* Main heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6 animate-fade-in-up">
            Make AI Text Sound Human
            <br />
            <span className="text-white/80">— Instantly</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            Transform AI-generated text into natural, human-sounding writing in seconds.
          </p>

          {/* CTA Button — scrolls to tool */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <button
              onClick={() => document.getElementById('tool-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-indigo-700 bg-white rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Humanize Text
            </button>
          </div>
        </div>

        {/* Decorative blurred shapes */}
        <div className="absolute top-10 left-10 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </section>

      {/* Main Tool Section */}
      <main id="tool-section" className="flex-1 max-w-6xl mx-auto w-full px-4 py-10 sm:px-6 -mt-8 relative z-20">
        {/* Floating Glass Card Container */}
        <div className="glass-card-strong rounded-2xl p-6 sm:p-8 space-y-6">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Input */}
            <InputPanel
              text={inputText}
              onTextChange={setInputText}
              onScan={handleScan}
              isProcessing={isProcessing}
            />

            {/* Right Column: Output */}
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
      <footer className="mt-auto py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-gray-400">
            This tool improves writing style and naturalness. Always review output before use.
          </p>
        </div>
      </footer>
    </div>
  );
}
