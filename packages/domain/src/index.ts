// Regras de domínio (balanceamento de times, notas, Cartola) como funções puras,
// sem depender de Nest, React ou banco. Cada regra fica na sua pasta em src/.
export * from './core';
export * from './balance-teams';
export * from './round-score';
export * from './cartola';
