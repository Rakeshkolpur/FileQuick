import React from 'react';
import {
  LuSheet, LuLayers, LuLayoutTemplate, LuShieldCheck,
} from 'react-icons/lu';
import OfficeToPdf from './OfficeToPdf';
import { fitXlsxToWidth } from '../../../lib/xlsxFit';

const EXCEL = {
  kind: 'excel',
  toolId: 'excel-to-pdf',
  endpoint: '/convert/excel-to-pdf',
  healthKey: 'excel_to_pdf',
  accept: '.xlsx,.xls,.xlsm,.ods,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.oasis.opendocument.spreadsheet,text/csv',
  formats: '.xlsx, .xls, .ods or .csv',
  dropTitle: 'Drop Excel spreadsheets here',
  noun: 'spreadsheet',
  icon: LuSheet,
  brand: ['#217346', '#2E9E5B', '#E7F5EC', '#86d3a6'],
  option: {
    label: 'Fit each sheet to the page width',
    desc: 'No columns cut off onto extra pages; wide sheets turn landscape. Turn off to use the workbook’s own print settings.',
    default: true,
    exts: ['xlsx', 'xlsm'],
    apply: fitXlsxToWidth,
  },
  features: [
    [LuLayers, 'Every sheet', 'All the sheets in the workbook go into the PDF, one after another.'],
    [LuLayoutTemplate, 'Your page setup', 'Print areas, page orientation, fit-to-page and headers are respected.'],
    [LuShieldCheck, 'Private', 'Deleted from the server the moment your PDF is ready.'],
  ],
};

const ExcelToPdf = () => <OfficeToPdf cfg={EXCEL} />;

export default ExcelToPdf;
