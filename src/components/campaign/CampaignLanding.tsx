'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import CafeSantoDomingoLogo from '@/components/ui/CafeSantoDomingoLogo';

const COFFEE_PRODUCTS = [
  'Café Santo Domingo Tradicional',
  'Café Santo Domingo Gran Origen Jarabacoa',
  'Café Santo Domingo Gran Origen Barahona',
  'Café Santo Domingo Especial en Grano',
  'Café Santo Domingo Suave Descafeinado',
  'Expresso Santo Domingo',
];

const TEMPLATE_STYLES = [
  {
    id: 'barista',
    title: 'Barista Santo Domingo',
    desc: 'Cafetería moderna con delantal bordado y taza roja humeante',
    emoji: '☕',
  },
  {
    id: 'colonial',
    title: 'Zona Colonial',
    desc: 'Atardecer cálido en el centro histórico de Santo Domingo',
    emoji: '🏛️',
  },
  {
    id: 'plantacion',
    title: 'Plantación Jarabacoa',
    desc: 'Entre cafetales verdes y montañas frescas dominicanas',
    emoji: '🌿',
  },
];

interface InitialUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  favoriteProduct?: string;
}

interface CampaignLandingProps {
  initialUser: InitialUser | null;
  campaignEnded: boolean;
}

export default function CampaignLanding({
  initialUser,
  campaignEnded,
}: CampaignLandingProps) {
  // Estado de pasos: 1 = Datos, 2 = Selfie, 3 = Resultado
  const [step, setStep] = useState<number>(initialUser ? 2 : 1);

  // Formulario Paso 1
  const [name, setName] = useState(initialUser?.name || '');
  const [email, setEmail] = useState(initialUser?.email || '');
  const [phone, setPhone] = useState(initialUser?.phone || '');
  const [favoriteProduct, setFavoriteProduct] = useState(
    initialUser?.favoriteProduct || COFFEE_PRODUCTS[0],
  );
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [acceptTerms, setAcceptTerms] = useState(true);

  // Estado Paso 2: Selfie y configuración
  const [selfieDataUrl, setSelfieDataUrl] = useState<string>('');
  const [templateStyle, setTemplateStyle] = useState<string>('barista');
  const [format, setFormat] = useState<'avatar' | 'video'>('avatar');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Estado Paso 3: Generación y resultado
  const [generating, setGenerating] = useState<boolean>(false);
  const [registering, setRegistering] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [copiedCaption, setCopiedCaption] = useState<boolean>(false);
  const [result, setResult] = useState<{
    imageUrl: string;
    videoUrl?: string;
    caption: string;
    title?: string;
  } | null>(null);

  // Limpiar cámara al desmontar
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Iniciar cámara
  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch {
      setError('No se pudo acceder a la cámara. Puedes subir una foto desde tus archivos.');
      setIsCameraActive(false);
    }
  };

  // Detener cámara
  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  // Capturar foto desde el video
  const takePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setSelfieDataUrl(dataUrl);
      stopCamera();
    }
  };

  // Manejar subida de archivo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setSelfieDataUrl(url);
      stopCamera();
    };
    reader.readAsDataURL(file);
  };

  // Enviar Paso 1 (Registro transparente)
  const handleSubmitStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }
    if (!acceptTerms) {
      setError('Debes aceptar los términos y condiciones de la campaña.');
      return;
    }

    setError('');
    setRegistering(true);

    try {
      const res = await fetch('/api/campaign/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          favoriteProduct,
          marketingOptIn,
          acceptTerms,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Error al guardar tus datos.');
      }

      // Autenticar de forma transparente mediante NextAuth
      if (data.tempPassword) {
        await signIn('credentials', {
          email,
          password: data.tempPassword,
          redirect: false,
        });
      }

      setStep(2);
    } catch (err: unknown) {
      setError((err as Error).message || 'Ocurrió un error al procesar tus datos.');
    } finally {
      setRegistering(false);
    }
  };

  // Enviar Paso 2 (Generar Avatar)
  const handleGenerate = async () => {
    setError('');
    setGenerating(true);

    try {
      const res = await fetch('/api/campaign/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selfie: selfieDataUrl,
          templateStyle,
          format,
          favoriteProduct,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Error al generar tu avatar.');
      }

      setResult(data.result);
      setStep(3);
    } catch (err: unknown) {
      setError((err as Error).message || 'Error al conectar con el motor de IA.');
    } finally {
      setGenerating(false);
    }
  };

  // Copiar copy para Instagram
  const handleCopyCaption = () => {
    if (!result?.caption) return;
    navigator.clipboard.writeText(result.caption);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 3000);
  };

  // Compartir en WhatsApp
  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `¡Mira mi Avatar Oficial de Café Santo Domingo! ☕🇩🇴 Genera el tuyo aquí: ${window.location.href}`,
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="relative min-h-screen bg-[#140b07] text-[#f7ede2] selection:bg-amber-500 selection:text-black">
      {/* Resplandor cálido de fondo */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-600/20 via-red-700/10 to-transparent blur-3xl sm:w-[900px]" />

      {/* Header oficial */}
      <header className="border-b border-amber-900/30 bg-[#1b0e09]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5">
          <CafeSantoDomingoLogo size="sm" />
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300">
              ☕ Campaña Oficial 2026
            </span>
            <Link
              href="/admin"
              className="text-xs text-amber-200/60 hover:text-amber-200 transition"
              title="Panel de Administración"
            >
              Admin ⚙️
            </Link>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {campaignEnded && (
          <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-950/40 p-4 text-center text-red-200">
            <h3 className="font-bold text-lg">Campaña Oficial Finalizada</h3>
            <p className="text-sm mt-1">
              Gracias por tu entusiasmo. El periodo de generación de avatares ha concluido.
            </p>
          </div>
        )}

        {/* Título de la campaña */}
        <div className="text-center mb-8">
          <span className="inline-block rounded-full bg-gradient-to-r from-red-600 to-amber-600 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-widest text-white shadow-lg">
            ¡Conviértete en el Rostro de Nuestro Café!
          </span>
          <h1 className="mt-4 font-serif text-3xl font-black sm:text-5xl text-white tracking-tight">
            Crea tu Avatar Oficial <br />
            <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-red-400 bg-clip-text text-transparent">
              Café Santo Domingo
            </span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-amber-100/70 max-w-lg mx-auto">
            Regístrate en 30 segundos, tómate una selfie y la inteligencia artificial te
            transformará en el embajador oficial del mejor café de nuestra tierra.
          </p>

          {/* Stepper visual */}
          <div className="mt-8 flex items-center justify-center gap-2 sm:gap-4">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                step === 1
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
              }`}
            >
              <span>1</span> Tus Datos
            </div>
            <span className="text-amber-800">→</span>
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                step === 2
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
              }`}
            >
              <span>2</span> Tu Selfie
            </div>
            <span className="text-amber-800">→</span>
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                step === 3
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
              }`}
            >
              <span>3</span> Tu Avatar
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/50 bg-red-950/50 p-4 text-sm text-red-200">
            ⚠️ {error}
          </div>
        )}

        {/* ── PASO 1: Formulario de Datos ────────────────────────── */}
        {step === 1 && (
          <div className="rounded-3xl border border-amber-900/40 bg-[#1e120c]/90 p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-white mb-2">
              Paso 1: Completa tus datos
            </h2>
            <p className="text-xs sm:text-sm text-amber-200/70 mb-6">
              Sin contraseñas difíciles: ingresa tus datos para personalizar tu insignia oficial.
            </p>

            <form onSubmit={handleSubmitStep1} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-amber-200 uppercase tracking-wider mb-1.5">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. María Rodríguez"
                  className="w-full rounded-xl border border-amber-800/40 bg-[#120a06] px-4 py-3 text-sm text-white placeholder-amber-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-200 uppercase tracking-wider mb-1.5">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full rounded-xl border border-amber-800/40 bg-[#120a06] px-4 py-3 text-sm text-white placeholder-amber-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-200 uppercase tracking-wider mb-1.5">
                  Teléfono / WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej. +1 809 555 1234"
                  className="w-full rounded-xl border border-amber-800/40 bg-[#120a06] px-4 py-3 text-sm text-white placeholder-amber-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-200 uppercase tracking-wider mb-1.5">
                  ¿Cuál es tu Café Santo Domingo Favorito?
                </label>
                <select
                  value={favoriteProduct}
                  onChange={(e) => setFavoriteProduct(e.target.value)}
                  className="w-full rounded-xl border border-amber-800/40 bg-[#120a06] px-4 py-3 text-sm text-white focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  {COFFEE_PRODUCTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-amber-700 bg-black text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-xs text-amber-200/80 leading-relaxed">
                    Deseo recibir ofertas exclusivas, novedades y descuentos de Café Santo
                    Domingo por WhatsApp y correo electrónico.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-amber-700 bg-black text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-xs text-amber-200/80 leading-relaxed">
                    Acepto los{' '}
                    <Link href="/terminos" target="_blank" className="text-amber-400 underline">
                      Términos y Condiciones
                    </Link>{' '}
                    y autorizo el procesamiento de mi imagen para esta campaña.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={registering || campaignEnded}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 py-4 text-center font-bold text-black shadow-lg shadow-amber-500/20 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
              >
                {registering ? 'Guardando datos...' : 'Continuar a Tomar mi Selfie →'}
              </button>
            </form>
          </div>
        )}

        {/* ── PASO 2: Toma de Selfie & Opciones ──────────────────── */}
        {step === 2 && (
          <div className="rounded-3xl border border-amber-900/40 bg-[#1e120c]/90 p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-white">
                Paso 2: Tu Selfie & Estilo
              </h2>
              <button
                onClick={() => setStep(1)}
                className="text-xs text-amber-400 hover:underline"
              >
                Editar datos
              </button>
            </div>
            <p className="text-xs sm:text-sm text-amber-200/70 mb-6">
              Participando como: <strong className="text-white">{name}</strong> ({favoriteProduct})
            </p>

            {/* Selector de Foto: Cámara o Archivo */}
            <div className="mb-6 rounded-2xl border border-amber-900/50 bg-[#140b07] p-4 text-center">
              {selfieDataUrl ? (
                <div className="flex flex-col items-center">
                  <div className="relative h-48 w-48 overflow-hidden rounded-full border-4 border-amber-400 shadow-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selfieDataUrl}
                      alt="Tu Selfie"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setSelfieDataUrl('');
                      setIsCameraActive(false);
                    }}
                    className="mt-3 text-xs text-amber-400 hover:underline"
                  >
                    🔄 Cambiar o repetir foto
                  </button>
                </div>
              ) : isCameraActive ? (
                <div className="flex flex-col items-center">
                  <div className="relative h-64 w-64 overflow-hidden rounded-2xl border-2 border-amber-500 bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={takePhoto}
                      className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-black hover:bg-amber-400"
                    >
                      📸 Disparar Foto
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="rounded-xl border border-amber-800 px-4 py-2 text-xs text-amber-300 hover:bg-amber-950"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-6">
                  <div className="text-4xl">📸</div>
                  <p className="text-sm font-medium text-amber-100">
                    Sube una foto clara de tu rostro o usa tu cámara
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-3">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="rounded-xl bg-amber-500/20 border border-amber-500/40 px-4 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-500/30"
                    >
                      🎥 Abrir Cámara en Vivo
                    </button>
                    <label className="cursor-pointer rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-black hover:bg-amber-400">
                      📁 Subir desde Archivos
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Selector de Estilo */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-amber-200 uppercase tracking-wider mb-2.5">
                Elige tu Escenario de Embajador
              </label>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {TEMPLATE_STYLES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateStyle(t.id)}
                    className={`rounded-2xl border p-3.5 text-left transition ${
                      templateStyle === t.id
                        ? 'border-amber-400 bg-amber-500/15 shadow-md'
                        : 'border-amber-900/30 bg-[#120a06] hover:border-amber-700/50'
                    }`}
                  >
                    <span className="text-xl">{t.emoji}</span>
                    <h4 className="mt-1 font-bold text-xs text-white">{t.title}</h4>
                    <p className="mt-1 text-[11px] text-amber-200/60 leading-tight">
                      {t.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Selector de Formato */}
            <div className="mb-8">
              <label className="block text-xs font-semibold text-amber-200 uppercase tracking-wider mb-2.5">
                Formato de Creación
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormat('avatar')}
                  className={`rounded-2xl border p-3 text-center transition ${
                    format === 'avatar'
                      ? 'border-amber-400 bg-amber-500/20 text-white font-bold'
                      : 'border-amber-900/30 bg-[#120a06] text-amber-300'
                  }`}
                >
                  🖼️ Avatar 3D (Foto)
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('video')}
                  className={`rounded-2xl border p-3 text-center transition ${
                    format === 'video'
                      ? 'border-amber-400 bg-amber-500/20 text-white font-bold'
                      : 'border-amber-900/30 bg-[#120a06] text-amber-300'
                  }`}
                >
                  🎬 Video Saludo Animado
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || campaignEnded}
              className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-amber-500 to-amber-400 py-4 text-center font-bold text-black shadow-xl shadow-amber-500/20 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="h-5 w-5 animate-spin text-black"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Creando tu Avatar con IA...
                </span>
              ) : (
                '¡Crear mi Avatar Café Santo Domingo! ☕✨'
              )}
            </button>
          </div>
        )}

        {/* ── PASO 3: Visualización del Resultado ────────────────── */}
        {step === 3 && result && (
          <div className="rounded-3xl border border-amber-900/40 bg-[#1e120c]/90 p-6 sm:p-8 shadow-2xl backdrop-blur-sm text-center">
            <span className="inline-block rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1 text-xs font-bold text-emerald-300 mb-3">
              🎉 ¡Felicidades! Eres Embajador Oficial
            </span>

            <h2 className="font-serif text-2xl sm:text-3xl font-black text-white mb-1">
              Tu Avatar Café Santo Domingo
            </h2>
            <p className="text-xs sm:text-sm text-amber-200/70 mb-6">
              Descárgalo en alta resolución y compártelo en tus redes.
            </p>

            {/* Vista previa de Imagen o Video */}
            <div className="mx-auto max-w-sm rounded-2xl overflow-hidden border-2 border-amber-400/50 shadow-2xl bg-black mb-6">
              {result.videoUrl ? (
                <video
                  src={result.videoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-auto object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={result.imageUrl}
                  alt={result.title || 'Avatar Café Santo Domingo'}
                  className="w-full h-auto object-cover"
                />
              )}
            </div>

            {/* Acciones principales */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <a
                href={result.imageUrl}
                download="mi-avatar-cafe-santo-domingo.png"
                className="rounded-xl bg-amber-500 px-5 py-3 text-xs font-bold text-black shadow-md hover:bg-amber-400"
              >
                📥 Descargar Imagen HD
              </a>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-emerald-500"
              >
                💬 Compartir en WhatsApp
              </button>

              <button
                type="button"
                onClick={handleCopyCaption}
                className="rounded-xl border border-amber-800 bg-[#120a06] px-5 py-3 text-xs font-bold text-amber-300 hover:bg-amber-950"
              >
                {copiedCaption ? '✓ ¡Texto Copiado!' : '📋 Copiar Texto para Instagram'}
              </button>
            </div>

            {/* Texto para redes sociales */}
            <div className="rounded-2xl border border-amber-900/40 bg-[#140b07] p-4 text-left mb-6">
              <span className="block text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1">
                Copy listo para tus redes:
              </span>
              <p className="text-xs text-amber-100/90 whitespace-pre-wrap leading-relaxed">
                {result.caption}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelfieDataUrl('');
                setStep(2);
              }}
              className="text-xs text-amber-400 hover:underline"
            >
              🔄 Crear otro avatar con un estilo diferente
            </button>
          </div>
        )}
      </main>

      {/* Footer oficial */}
      <footer className="border-t border-amber-900/30 py-8 text-center text-xs text-amber-200/50 mt-16">
        <div className="mx-auto max-w-4xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Café Santo Domingo · Campaña Promocional Oficial</p>
          <div className="flex gap-4">
            <Link href="/terminos" className="hover:text-amber-200 underline">
              Términos de Campaña
            </Link>
            <Link href="/privacidad" className="hover:text-amber-200 underline">
              Privacidad de Datos
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
