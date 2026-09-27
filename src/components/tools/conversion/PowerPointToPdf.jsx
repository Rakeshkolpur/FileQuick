import React from 'react';
import {
  LuPresentation, LuLayoutTemplate, LuImage, LuShieldCheck,
} from 'react-icons/lu';
import OfficeToPdf from './OfficeToPdf';

const POWERPOINT = {
  kind: 'powerpoint',
  toolId: 'powerpoint-to-pdf',
  endpoint: '/convert/powerpoint-to-pdf',
  healthKey: 'powerpoint_to_pdf',
  accept: '.pptx,.ppt,.odp,.pps,.ppsx,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.slideshow,application/vnd.oasis.opendocument.presentation',
  formats: '.pptx, .ppt, .odp or .ppsx',
  dropTitle: 'Drop PowerPoint presentations here',
  noun: 'presentation',
  icon: LuPresentation,
  brand: ['#C43E1C', '#E3643F', '#FDEEE9', '#f4a58c'],
  features: [
    [LuLayoutTemplate, 'Slides as they look', 'Every slide becomes one PDF page, in its own shape and size.'],
    [LuImage, 'Pictures & backgrounds', 'Images, shapes, charts, colours and slide backgrounds come through.'],
    [LuShieldCheck, 'Private', 'Deleted from the server the moment your PDF is ready.'],
  ],
};

const PowerPointToPdf = () => <OfficeToPdf cfg={POWERPOINT} />;

export default PowerPointToPdf;
