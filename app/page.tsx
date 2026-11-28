import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ConsultaEnviada } from "@/components/consulta-enviada";
import { FormularioDeConsulta } from "@/components/formulario-de-consulta";
import { ListadoDePropiedades } from "@/components/propiedades/listado-de-propiedades";
import { aplicarFiltros } from "@/lib/actions/filtros";
import { getFacets, getFeaturedListings } from "@/lib/data/queries";
import type { Condition, ListingFilters } from "@/lib/domain";
import { PARAMS, urlDelListado } from "@/lib/filters";
import { CONSULTA_ENVIADA, PARAM_CONSULTA } from "@/lib/forms/consulta";
import { formatearEntero } from "@/lib/format";

// La home.
//
// La cáscara estática es el encabezado y el buscador. Todo lo que depende de
// datos va en un `<Suspense>` y se resuelve POR REQUEST, con un
// `await connection()` antes de leer, aunque las lecturas estén cacheadas y
// podrían prerenderizarse.
//
// Eso último parece contradecir que la home sea cacheable, y es a propósito:
// la imagen Docker se construye SIN `DATA_SOURCE` (ninguna variable de la API
// es build-arg, para que la misma imagen sirva staging y producción), así que
// durante el build las lecturas fallan y degradan a vacío. Si los bloques se
// prerenderizaran, la cáscara quedaría horneada con cero destacadas y sin
// conteos, y así se serviría. Lo verificamos: construyendo sin `DATA_SOURCE` y
// levantando con `DATA_SOURCE=mock`, la home servía la cáscara vacía en todos
// los requests.
//
// No cuesta pedidos extra: el caché sigue estando donde importa, en los
// repositorios (`use cache`), que es lo que protege del rate limit de la API.

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Nazar Propiedades</h1>
        <p>Casas, departamentos, terrenos y locales en Mendoza.</p>
        <BuscadorRapido />
      </section>

      {/* Los accesos rápidos son links de verdad con los filtros en la URL:
          funcionan sin JavaScript, se pueden compartir y los indexa Google. */}
      <Suspense fallback={null}>
        <AccesosRapidos />
      </Suspense>

      {/* Sin fallback visible: el bloque puede terminar vacío (la API caída
          degrada a `[]`), y sin JavaScript un "Cargando…" se queda pegado
          donde no va a aparecer nada. */}
      <Suspense fallback={null}>
        <Destacadas />
      </Suspense>

      <Suspense fallback={null}>
        <Consulta searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// El mismo submit que el filtro del listado: la Server Action devuelve la URL
// canónica, así que buscar desde acá y buscar desde el listado llevan a la
// misma dirección. Un `<form method="get">` dejaría `?direccion=` cuando se
// busca con el campo vacío.
function BuscadorRapido() {
  return (
    <form action={aplicarFiltros} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col text-sm">
        {/* "Dirección o barrio", NO "buscar": la API busca solo en barrio/calle
            y dirección, no en el título ni en la descripción. */}
        Dirección o barrio
        <input
          type="search"
          name={PARAMS.direccion}
          placeholder="Ej.: Chacras de Coria, Viamonte"
          className="border px-2 py-1"
        />
      </label>
      <button type="submit" className="border px-4 py-2">
        Buscar
      </button>
      <Link href={urlDelListado({})} className="border px-4 py-2">
        Ver todas las propiedades
      </Link>
    </form>
  );
}

// Las operaciones son un enum del front, así que no dependen de ninguna
// lectura: siempre se pueden ofrecer.
//
// Y se ofrecen las tres SIEMPRE, incluso con conteo 0, al contrario que los
// departamentos: esconder "Alquiler" porque hoy no hay ninguno publicado hace
// parecer que la inmobiliaria no alquila. Un "(0)" dice la verdad y es
// información. Un departamento con 0, en cambio, no dice nada: es uno de
// dieciocho que podrían faltar.
const OPERACIONES: readonly { condition: Condition; etiqueta: string }[] = [
  { condition: "sale", etiqueta: "Propiedades en venta" },
  { condition: "rent", etiqueta: "Propiedades en alquiler" },
  { condition: "temporary_rent", etiqueta: "Alquileres temporarios" },
];

// Cuántos departamentos se ofrecen. Son 18 en Mendoza y la home no es un
// índice: van los que más propiedades tienen publicadas.
const DEPARTAMENTOS_EN_LA_HOME = 6;

async function AccesosRapidos() {
  // Por request, no horneado en el build: ver el comentario de arriba.
  await connection();
  const facets = await getFacets();

  const acceso = (filtros: ListingFilters, etiqueta: string, count: number | null) => (
    <li key={`${etiqueta}-${count ?? ""}`}>
      <Link href={urlDelListado(filtros)} className="border px-3 py-2">
        {etiqueta}
        {count === null ? null : ` (${formatearEntero(count)})`}
      </Link>
    </li>
  );

  // Los conteos salen de facets, que es la verdad sobre lo que hay publicado.
  // Si la lectura falló se ofrecen los links sin conteo: un acceso sin número
  // sirve igual, y esconder los accesos porque no sabemos cuántos hay es peor.
  const conteoDeOperacion = (condition: Condition): number | null =>
    facets.ok
      ? (facets.data.conditions.find((entrada) => entrada.value === condition)?.count ?? 0)
      : null;

  const departamentos = facets.ok
    ? facets.data.provinces
        .flatMap((provincia) => provincia.departments)
        // Los que más tienen primero, y nunca uno con 0: un acceso rápido a una
        // lista vacía es una promesa incumplida. (En el filtro del listado un 0
        // sí se muestra, deshabilitado, porque ahí informa qué categorías
        // existen; acá es un atajo, no un catálogo.)
        .filter((departamento) => departamento.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, DEPARTAMENTOS_EN_LA_HOME)
    : [];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Buscá por operación</h2>
      <ul className="flex flex-wrap gap-2">
        {OPERACIONES.map((operacion) =>
          acceso(
            { condition: [operacion.condition] },
            operacion.etiqueta,
            conteoDeOperacion(operacion.condition),
          ),
        )}
      </ul>

      {departamentos.length === 0 ? null : (
        <>
          <h2 className="text-lg font-semibold">Buscá por zona</h2>
          <ul className="flex flex-wrap gap-2">
            {departamentos.map((departamento) =>
              acceso(
                // La provincia viaja junto al departamento: el filtro del
                // listado muestra los departamentos de la provincia elegida, y
                // sin ella el visitante no puede ver qué más hay cerca.
                { province: provinciaDe(departamento.value, facets), department: [departamento.value] },
                departamento.label,
                departamento.count,
              ),
            )}
          </ul>
        </>
      )}
    </section>
  );
}

// El departamento no sabe a qué provincia pertenece: se busca en el árbol de
// facets, que es de donde salió.
function provinciaDe(
  departamento: string,
  facets: Awaited<ReturnType<typeof getFacets>>,
): string | undefined {
  if (!facets.ok) return undefined;
  return facets.data.provinces.find((provincia) =>
    provincia.departments.some((actual) => actual.value === departamento),
  )?.value;
}

async function Destacadas() {
  // `getFeaturedListings` y no `getLatestListings`, aunque hoy devuelvan lo
  // mismo: cuando la API tenga `featured` cambia esa función y la home no se
  // toca. Usa `attemptOr`, así que una falla devuelve [] y la home se muestra
  // sin el bloque — un cartel de error en la home es peor que la ausencia.
  await connection();
  const destacadas = await getFeaturedListings();
  if (destacadas.length === 0) return null;

  const ahora = new Date();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Propiedades destacadas</h2>
      <ListadoDePropiedades listings={destacadas} ahora={ahora} />
      <p>
        <Link href={urlDelListado({})} className="underline">
          Ver todas las propiedades
        </Link>
      </p>
    </section>
  );
}

async function Consulta({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const query = await searchParams;
  const valor = query[PARAM_CONSULTA];
  const enviada = (Array.isArray(valor) ? valor[0] : valor) === CONSULTA_ENVIADA;

  if (enviada) return <ConsultaEnviada volverA="/" />;

  return (
    <FormularioDeConsulta
      fuente="consulta_general"
      titulo="¿Buscás algo que no encontrás?"
      descripcion="Contanos qué necesitás y te ayudamos a encontrarlo."
      volverA="/"
    />
  );
}
