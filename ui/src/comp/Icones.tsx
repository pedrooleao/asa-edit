// Icones de traco simples (24x24), desenhados aqui para o app funcionar sem internet.

const CAMINHOS: Record<string, string> = {
  mixer: 'M6 3v18M12 3v18M18 3v18M3 15h6M9 8h6M15 13h6',
  retornos: 'M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H5a1 1 0 0 1-1-1zM20 15h-3v5h2a1 1 0 0 0 1-1z',
  roteamento: 'M5 6h4l6 12h4M5 18h4l2-4M15 10l2-4h2M17 3l3 3-3 3M17 15l3 3-3 3',
  efeitos: 'M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9zM5 15l.6 1.4L7 17l-1.4.6L5 19l-.6-1.4L3 17l1.4-.6z',
  medidores: 'M5 20V10M10 20V4M15 20v-7M20 20V8',
  monitor: 'M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  biblioteca: 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  config: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  celular: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2',
  fechar: 'M6 6l12 12M18 6L6 18',
  mais: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  estrela: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z',
  seta: 'M9 6l6 6-6 6',
  voltar: 'M15 6l-6 6 6 6',
  baixo: 'M6 9l6 6 6-6',
  lateral: 'M4 4h16v16H4zM15 4v16',
  painel: 'M4 4h16v16H4zM4 14h16',
  copiar: 'M9 9h10v10H9zM5 15V5h10',
  editar: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  lixo: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  salvar: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7',
  abrir: 'M4 20V5a1 1 0 0 1 1-1h5l2 2h7a1 1 0 0 1 1 1v3M4 20l3-9h15l-3 9z',
  baixar: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  wifi: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  cadeado: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  aviso: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  check: 'M5 12l5 5L20 7',
  arrastar: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
};

export function Icone({ nome, tamanho = 1.25, className }: { nome: keyof typeof CAMINHOS | string; tamanho?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={`${tamanho}rem`}
      height={`${tamanho}rem`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={CAMINHOS[nome] || ''} />
    </svg>
  );
}
