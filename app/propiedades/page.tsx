import { Suspense } from "react";
import { connection } from "next/server";
import { FallaDeDatos } from "@/components/falla-de-datos";
import { AvisoDeDescartados } from "@/components/propiedades/aviso-de-descartados";
import { FiltrosAplicados } from "@/components/propiedades/filtros-aplicados";
import { FiltrosDePropiedades } from "@/components/propiedades/filtros-de-propiedades";
import { ListadoDePropiedades } from "@/components/propiedades/listado-de-propiedades";
import { PaginaFueraDeRango } from "@/components/propiedades/pagina-fuera-de-rango";
import { Paginador } from "@/components/propiedades/paginador";
import { SinResultados } from "@/components/propiedades/sin-resultados";
import { searchListings } from "@/lib/data/queries";
import { pluralizar } from "@/lib/format";
import { resolverConsulta, type Consulta } from "./consulta";

// El listado: la ruta principal del sitio.
//
// Streaming, que con `cacheComponents` hay que decidir a mano: la página NO
// hace `await` de nada, así que la cáscara (el `<main>` y el título) se
// prerenderiza estática y sale al instante. Todo lo que depende de
// `searchParams` —que es dinámico— va adentro de un `<Suspense>`, o el
// prerender se bloquea y el build falla con `blocking-prerender-dynamic`.
//
// Son DOS boundaries y no uno: los filtros salen de lecturas cacheadas
// (catálogo y facets) y llegan antes que los resultados, que dependen de los
// filtros de la URL. Con un solo boundary el formulario esperaría a la búsqueda
// sin ninguna razón.
//
// `resolverConsulta` se llama una vez y la promesa se comparte: las dos
// secciones hacen `await` de la MISMA, así que el parseo y las lecturas del
// catálogo no se hacen dos veces.

export default function PropiedadesPage({ searchParams }: PageProps<"/propiedades">) {
  const consulta = resolverConsulta(searchParams);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Propiedades</h1>

      <Suspense fallback={<p>Cargando filtros…</p>}>
        <SeccionDeFiltros consulta={consulta} />
      </Suspense>

      <Suspense fallback={<p>Buscando propiedades…</p>}>
        <SeccionDeResultados consulta={consulta} />
      </Suspense>
    </main>
  );
}

async function SeccionDeFiltros({ consulta }: { consulta: Promise<Consulta> }) {
  const { filtros, facets, catalog, monedaForzada, descartados } = await consulta;

  return (
    <div className="flex flex-col gap-3">
      <AvisoDeDescartados descartados={descartados} />
      <FiltrosDePropiedades
        filtros={filtros}
        facets={facets}
        catalog={catalog}
        monedaForzada={monedaForzada}
      />
    </div>
  );
}

async function SeccionDeResultados({ consulta }: { consulta: Promise<Consulta> }) {
  const { filtros, pagina, catalog } = await consulta;
  const resultado = await searchListings(filtros, pagina);

  // "hace 3 días" necesita la hora, y leer el reloj en el render de un
  // componente rompe el prerender: se declara el acceso dinámico una vez y se
  // baja la fecha por props.
  await connection();
  const ahora = new Date();

  // La búsqueda falló (API caída, timeout, payload roto). Los filtros siguen
  // arriba: el visitante puede cambiar la búsqueda sin perder lo que escribió.
  if (!resultado.ok) return <FallaDeDatos failure={resultado.failure} como="section" />;

  const { items, total, page, totalPages } = resultado.data;

  if (items.length === 0) {
    // Vacío por dos razones distintas, y confundirlas miente: si la búsqueda
    // tiene resultados pero no en esta página (`?pagina=99`, o un link viejo),
    // "no encontramos propiedades" es falso.
    return total > 0 ? (
      <PaginaFueraDeRango filtros={filtros} totalPages={totalPages} />
    ) : (
      <SinResultados filtros={filtros} catalog={catalog} />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {/* El total es el de la búsqueda completa, no el de la página: es el dato
          que le dice al visitante si vale la pena filtrar más. */}
      <p aria-live="polite">{pluralizar(total, "propiedad", "propiedades")}</p>
      <FiltrosAplicados filtros={filtros} catalog={catalog} />
      <ListadoDePropiedades listings={items} ahora={ahora} />
      {/* `totalPages` es 0 sin resultados, no 1: el paginador no se dibuja. */}
      <Paginador filtros={filtros} pagina={page} totalPages={totalPages} />
    </section>
  );
}
