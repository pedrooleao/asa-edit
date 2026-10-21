'use strict';

// Processo principal do Electron: sobe o servidor local e abre a janela.

const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { iniciarServidor } = require('./servidor');

let janela = null;
let servidor = null;
let pronto = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (janela) { if (janela.isMinimized()) janela.restore(); janela.focus(); }
  });
  iniciar();
}

function arqJanela() {
  return path.join(app.getPath('userData'), 'janela.json');
}

function iniciar() {
  servidor = iniciarServidor({ pastaConfig: app.getPath('userData') });
  servidor.on('pronto', (info) => {
    pronto = info;
    if (app.isReady()) abrirJanela();
  });
  servidor.on('falhou', (err) => {
    app.whenReady().then(() => {
      dialog.showErrorBox('Asa Edit', `Nao consegui iniciar: ${err.message}`);
      app.exit(1);
    });
  });

  app.whenReady().then(() => {
    montarMenu();
    if (pronto) abrirJanela();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0 && pronto) abrirJanela();
    });
  });

  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { if (servidor) servidor.fechar(); });
}

function abrirJanela() {
  if (janela && !janela.isDestroyed()) { janela.focus(); return; }
  let limites = { width: 1440, height: 900 };
  try { limites = { ...limites, ...JSON.parse(fs.readFileSync(arqJanela(), 'utf8')) }; } catch { /* primeira vez */ }

  janela = new BrowserWindow({
    ...limites,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#17191d',
    title: 'Asa Edit',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 14 },
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  janela.loadURL(pronto.url);
  janela.once('ready-to-show', () => janela.show());
  janela.on('close', () => {
    try {
      fs.writeFileSync(arqJanela(), JSON.stringify({ ...janela.getBounds(), zoom: janela.webContents.getZoomFactor() }));
    } catch { /* sem disco */ }
  });
  janela.webContents.on('did-finish-load', () => {
    try {
      const z = JSON.parse(fs.readFileSync(arqJanela(), 'utf8')).zoom;
      if (z) janela.webContents.setZoomFactor(z);
    } catch { /* padrao */ }
  });
  janela.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function montarMenu() {
  const mac = process.platform === 'darwin';
  const template = [
    ...(mac ? [{ role: 'appMenu', label: 'Asa Edit' }] : []),
    { role: 'editMenu', label: 'Editar' },
    {
      label: 'Visualizar',
      submenu: [
        { role: 'resetZoom', label: 'Tamanho normal' },
        { role: 'zoomIn', label: 'Aumentar' },
        { role: 'zoomOut', label: 'Diminuir' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela cheia' },
        { type: 'separator' },
        { role: 'reload', label: 'Recarregar' },
        { role: 'toggleDevTools', label: 'Ferramentas de desenvolvedor' },
      ],
    },
    { role: 'windowMenu', label: 'Janela' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
