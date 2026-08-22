// components/session/RulesViewer.tsx
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Book } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Настройка PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface RuleSection {
  id: string;
  title: string;
  pages: number[];
}

interface RulesMetadata {
  rule_id: string;
  title: string;
  sections: RuleSection[];
  total_pages: number;
}

interface RulesViewerProps {
  ruleId: string;
  open: boolean;
  onClose: () => void;
}

export function RulesViewer({ ruleId, open, onClose }: RulesViewerProps) {
  const [metadata, setMetadata] = useState<RulesMetadata | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (open && ruleId) {
      fetch(`/api/rules/${ruleId}/metadata`)
        .then((r) => r.json())
        .then(setMetadata);
    }
  }, [open, ruleId]);

  const pdfUrl = `/api/rules/${ruleId}/pdf`;

  const goToSection = (section: RuleSection) => {
    setCurrentPage(section.pages[0]);
    setActiveSection(section.id);
  };

  const nextPage = () => {
    if (currentPage < numPages) setCurrentPage(currentPage + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  // Определяем текущую секцию по странице
  useEffect(() => {
    if (!metadata) return;
    const section = metadata.sections.find((s) =>
      s.pages.includes(currentPage)
    );
    setActiveSection(section?.id ?? null);
  }, [currentPage, metadata]);

  if (!metadata) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 bg-gray-900 text-white flex">
        {/* Боковая панель: оглавление */}
        <div className="w-64 border-r border-gray-700 p-4 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <Book className="w-5 h-5 text-teal-400" />
            <h2 className="font-semibold text-sm">{metadata.title}</h2>
          </div>
          <nav className="space-y-1">
            {metadata.sections.map((section) => (
              <button
                key={section.id}
                onClick={() => goToSection(section)}
                className={`w-full text-left text-sm px-3 py-2 rounded transition-colors ${
                  activeSection === section.id
                    ? 'bg-teal-500/20 text-teal-300 border-l-2 border-teal-400'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                {section.title}
                <span className="text-xs text-gray-500 ml-2">
                  ({section.pages[0]}-{section.pages[section.pages.length - 1]})
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Основная область: PDF */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <Button size="sm" variant="ghost" onClick={prevPage} disabled={currentPage <= 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-300">
              Страница {currentPage} / {numPages}
            </span>
            <Button size="sm" variant="ghost" onClick={nextPage} disabled={currentPage >= numPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-4 flex justify-center bg-gray-950">
            <Document
              file={pdfUrl}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              className="flex justify-center"
            >
              <Page
                pageNumber={currentPage}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-lg"
                width={800}
              />
            </Document>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
