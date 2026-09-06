import React, { useState } from 'react';
import { Smartphone, Laptop, CheckSquare, Square, Terminal, ExternalLink, HelpCircle } from 'lucide-react';

export const InstallGuide: React.FC = () => {
  const [checkedSteps, setCheckedSteps] = useState<{ [key: string]: boolean }>({});

  const toggleStep = (id: string) => {
    setCheckedSteps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Header Intro Card - Geometric Balance */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#181818] border border-white/5 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1DB954]/10 border border-[#1DB954]/30 flex items-center justify-center text-[#1DB954]">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#1DB954] block">
              Despliegue Móvil
            </span>
            <h2 className="text-xl font-black tracking-tight text-white">
              Guía de Instalación en Firefox Android
            </h2>
          </div>
        </div>

        <p className="text-sm text-white/70 leading-relaxed">
          En Android, Firefox bloquea la instalación directa de archivos <code>.xpi</code> no firmados en la versión estable regular de la Play Store. 
          Sin embargo, existen <strong className="text-white font-bold">3 métodos oficiales y directos</strong> para cargar complementos de desarrollo temporales o permanentes:
        </p>
      </div>

      {/* Method 1: USB Remote Debugging (Fastest for testing) */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#181818] border border-white/5 shadow-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <Laptop className="w-5 h-5 text-[#1DB954]" />
            <h3 className="text-base font-black tracking-tight text-white">
              Método 1: Depuración Remota vía USB (about:debugging)
            </h3>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20 font-bold uppercase tracking-wider font-mono">
            Recomendado para Pruebas (30 seg)
          </span>
        </div>

        <p className="text-xs text-white/60">
          Permite cargar la extensión directamente desde la carpeta en tu ordenador hacia tu teléfono Android conectado con un cable USB.
        </p>

        <div className="space-y-3">
          {[
            {
              id: 'a1',
              title: 'Habilitar Menú de Desarrollador en Firefox Android',
              desc: 'En tu teléfono, abre Firefox Nightly o Beta. Ve a Ajustes > Acerca de Firefox y toca el logotipo de Firefox 5 veces continuas hasta que aparezca el aviso "Ajustes de desarrollador desbloqueados".'
            },
            {
              id: 'a2',
              title: 'Activar Depuración USB en Firefox Android',
              desc: 'En los Ajustes de Firefox Android, entra al nuevo menú "Ajustes de desarrollador" y activa el interruptor "Depuración USB".'
            },
            {
              id: 'a3',
              title: 'Conectar el teléfono al PC con cable USB',
              desc: 'Asegúrate de que la "Depuración por USB" de Android (Opciones de desarrollador de Android) también esté activa. Acepta el cuadro de diálogo de huella digital RSA si aparece.'
            },
            {
              id: 'a4',
              title: 'Abrir about:debugging en Firefox de Escritorio',
              desc: 'En tu ordenador, abre Firefox y navega a: about:debugging#/setup. En la barra lateral izquierda verás tu dispositivo Android listado; pulsa "Conectar".'
            },
            {
              id: 'a5',
              title: 'Cargar el complemento temporal',
              desc: 'Haz clic en el botón "Cargar complemento temporal..." y selecciona el archivo manifest.json dentro de la carpeta spotify-controls/ descomprimida.'
            }
          ].map((step, idx) => (
            <div
              key={step.id}
              onClick={() => toggleStep(step.id)}
              className="p-4 rounded-xl bg-black/40 border border-white/5 flex items-start gap-3.5 cursor-pointer hover:border-white/20 transition"
            >
              <button className="mt-0.5 text-white/40 hover:text-[#1DB954]">
                {checkedSteps[step.id] ? (
                  <CheckSquare className="w-4 h-4 text-[#1DB954]" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
              <div className="space-y-1">
                <div className={`text-xs font-bold ${checkedSteps[step.id] ? 'text-[#1DB954] line-through' : 'text-white'}`}>
                  {idx + 1}. {step.title}
                </div>
                <div className="text-[11px] text-white/50 leading-relaxed">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Method 2: web-ext command line */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#181818] border border-white/5 shadow-2xl space-y-4">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-5 h-5 text-purple-400" />
          <h3 className="text-base font-black tracking-tight text-white">
            Método 2: Ejecución automática con web-ext CLI
          </h3>
        </div>
        <p className="text-xs text-white/60">
          Si tienes Node.js instalado, puedes usar la herramienta oficial de Mozilla <code>web-ext</code> para desplegar la extensión en tu dispositivo con un solo comando:
        </p>

        <div className="p-4 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-[#1DB954] overflow-x-auto">
          npx web-ext run --target=firefox-android --android-device=&lt;ID_DISPOSITIVO&gt; --source-dir=spotify-controls
        </div>

        <p className="text-[11px] text-white/40">
          Para ver el ID de tu dispositivo, ejecuta <code>adb devices</code> en tu terminal.
        </p>
      </div>

      {/* Method 3: Custom Add-on Collection (Permanent) */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#181818] border border-white/5 shadow-2xl space-y-4">
        <div className="flex items-center gap-2.5">
          <HelpCircle className="w-5 h-5 text-blue-400" />
          <h3 className="text-base font-black tracking-tight text-white">
            Método 3: Colección Personalizada de Complementos (Uso Diario Permanente)
          </h3>
        </div>
        <p className="text-xs text-white/70 leading-relaxed">
          Para que la extensión permanezca instalada de forma permanente en tu móvil sin requerir el cable USB cada vez:
        </p>
        <ol className="text-xs text-white/60 space-y-2 list-decimal list-inside leading-relaxed">
          <li>Crea una cuenta en <a href="https://addons.mozilla.org" target="_blank" rel="noreferrer" className="text-[#1DB954] underline hover:text-[#1ED760]">addons.mozilla.org (AMO)</a>.</li>
          <li>Crea una colección llamada por ejemplo <code>MisControles</code> y añade tus complementos.</li>
          <li>En Firefox Nightly Android: <strong>Ajustes &gt; Colección personalizada de complementos</strong>.</li>
          <li>Introduce tu ID de usuario de AMO y el nombre de la colección. Firefox se reiniciará y la extensión estará en tu menú de complementos de forma persistente.</li>
        </ol>
      </div>
    </div>
  );
};
