// Uso: npx ts-node -T scripts/probar-entorno.ts   (falla con código 1 si algún caso no da lo esperado)
import { detectarModo } from '../src/config/entorno';

const iface = (...ips: string[]) => ({ eth0: ips.map(address => ({ address, family: 'IPv4', internal: false })) }) as any;
const casos: { nombre: string; env: any; ifs: any; esperado: string }[] = [
    { nombre: 'IP del servidor 10.0.1.10',          env: {},                         ifs: iface('10.0.1.10'),    esperado: 'oracle' },
    { nombre: 'LAN 192.168.1.35',                    env: {},                         ifs: iface('192.168.1.35'), esperado: 'local' },
    { nombre: 'localhost 127.0.0.1',                 env: {},                         ifs: iface('127.0.0.1'),    esperado: 'local' },
    { nombre: 'otra 10.x (10.0.1.20)',               env: {},                         ifs: iface('10.0.1.20'),    esperado: 'local' },
    { nombre: 'Docker 172.18.0.2 sin APP_MODE',      env: {},                         ifs: iface('172.18.0.2'),   esperado: 'local' },
    { nombre: 'APP_MODE=oracle + 192.168.1.35',      env: { APP_MODE: 'oracle' },     ifs: iface('192.168.1.35'), esperado: 'oracle' },
    { nombre: 'APP_MODE=local + 10.0.1.10',          env: { APP_MODE: 'local' },      ifs: iface('10.0.1.10'),    esperado: 'local' },
    { nombre: 'ORACLE_BACK_IP personalizada',        env: { ORACLE_BACK_IP: '10.9.9.9' }, ifs: iface('10.9.9.9'), esperado: 'oracle' },
];
let mal = 0;
for (const c of casos) {
    const r = detectarModo(c.env, c.ifs);
    const ok = r.modo === c.esperado;
    if (!ok) mal++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.nombre.padEnd(38)} -> ${r.modo} (${r.motivo})`);
}
console.log(mal ? `\n${mal} caso(s) fallaron` : '\nTodos los casos OK');
process.exit(mal ? 1 : 0);
