import React from 'react';
import {
  LuFileText, LuType, LuSparkles, LuShieldCheck,
} from 'react-icons/lu';
import OfficeToPdf from './OfficeToPdf';

const WORD = {
  kind: 'word',
  toolId: 'word-to-pdf',
  endpoint: '/convert/word-to-pdf',
  healthKey: 'word_to_pdf',
  accept: '.docx,.doc,.odt,.rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/vnd.oasis.opendocument.text,application/rtf,text/rtf',
  formats: '.docx, .doc, .odt or .rtf',
  dropTitle: 'Drop Word documents here',
  noun: 'document',
  icon: LuFileText,
  brand: ['#2B579A', '#3f7bd6', '#EAF1FB', '#93b8f0'],
  features: [
    [LuType, 'Your exact fonts', 'The fonts on your computer are packed in, so the PDF looks just like Word.'],
    [LuSparkles, 'Real layout', 'Tables, images, headers, footers and page breaks — converted by LibreOffice.'],
    [LuShieldCheck, 'Private', 'Deleted from the server the moment your PDF is ready.'],
  ],
};

const WordToPdf = () => <OfficeToPdf cfg={WORD} />;

export default WordToPdf;
