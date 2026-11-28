import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { FallaDeDatos } from "@/components/falla-de-datos";
import { ConsultaEnviada } from "@/components/consulta-enviada";
import { FormularioDeConsulta } from "@/components/formulario-de-consulta";
import { BloqueDeAtributos } from "@/components/propiedades/bloque-de-atributos";
import { Galeria } from "@/components/propiedades/galeria";
import { ListadoDePropiedades } from "@/components/propiedades/listado-de-propiedades";
import { MapaDePropiedad } from "@/components/propiedades/mapa-de-propiedad";
import { OtrosAvisos } from "@/components/propiedades/otros-avisos";
import { getCatalog, getListing, getRelatedListings } from "@/lib/data/queries";
import { CONSULTA_ENVIADA, PARAM_CONSULTA } from "@/lib/forms/consulta";
import {
  descripcionDePropiedad,
  fotosParaCompartir,
  jsonLdAHtml,
  jsonLdDePropiedad,
} from "@/lib/seo";
import { getSiteUrl } from "@/lib/config";
import {
  formatearExpensas,
  formatearPrecioPorMes,
  formatearPublicacion,
  slugDePropiedad,
  textoDeUbicacion,
  tituloDePropiedad,
  urlDePropiedad,
} from "@/lib/format";

// La ficha de una propiedad. Es la página que más importa: a esta llegan desde
// Google y desde los links que se comparten.
//
// La URL canónica es `/propiedad/{id}/{slug}` y el slug es DECORATIVO: la API
// no tiene slug y lo único que identifica la propiedad es el id. El segmento es
// un catch-all opcional para que `/propiedad/{id}` también resuelva (los otros
// avisos de la misma propiedad llegan sin tipo ni ubicación, así que sus links
// no pueden armar el slug) y redirija al canónico.
//
// Qué pasa con los códigos de estado, que acá importan porque es la URL que
// indexa Google: con `cacheComponents` la respuesta arranca con 200 en cuanto
// sale la cáscara, SIEMPRE. O sea que `notFound()` no devuelve un 404 de HTTP:
// renderiza la pantalla de 404 y Next agrega `<meta name="robots"
// content="noindex">` en el stream, que es lo que mantiene la URL fuera del
// índice. Lo mismo con el redirect del slug, que viaja dentro del stream.
//
// La única forma de un 404 "duro" sería chequear antes de que empiece el
// stream, en Proxy, y ahí no se puede saber si el id existe sin pedirle la
// propiedad a la API en cada request. No vale la pena: lo que protege el SEO es
// el `noindex`, y ya está.
//
// El contenido va en un `<Suspense>` y no bloqueando la página: sin boundary,
// el HTML sale con la cáscara vacía y la ficha entera se renderiza en el
// cliente desde el payload de RSC. Lo verificamos: con boundary el HTML trae la
// ficha completa (59 KB), sin boundary trae 13 KB de cáscara y nada de
// contenido. En la página que tiene que indexar Google eso no es un detalle.
type PropsDeLaRuta = PageProps<"/propiedad/[id]/[[...slug]]">;

// Un id no numérico no es una propiedad que falte: es una URL que no existe, y
// se descarta sin tocar la red.
function idDeParam(crudo: string): number | null {
  if (!/^\d+$/.test(crudo)) return null;
  const id = Number(crudo);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Esta es la página que se comparte por WhatsApp y la que llega desde Google,
// así que la metadata no es decorativa.
//
// Pide la misma propiedad que la página: Next deduplica el pedido y además la
// lectura está cacheada con `use cache`, así que no son dos viajes a la API.
export async function generateMetadata({ params }: PropsDeLaRuta): Promise<Metadata> {
  const { id: crudo } = await params;
  const id = idDeParam(crudo);
  // Sin propiedad no hay nada que describir. El `noindex` es por las dudas: la
  // página va a devolver 404, pero con streaming el status es 200 (ver abajo).
  const sinPropiedad: Metadata = {
    title: "No encontramos esta propiedad",
    robots: { index: false, follow: true },
  };
  if (id === null) return sinPropiedad;

  const resultado = await getListing(id);
  if (!resultado.ok || resultado.data === null) return sinPropiedad;

  const listing = resultado.data;
  const titulo = tituloDePropiedad(listing);
  const descripcion = descripcionDePropiedad(listing);
  // Una sola forma canónica: la URL con el slug derivado. Las otras redirigen,
  // pero la canónica lo deja explícito para los buscadores.
  const url = urlDePropiedad(listing);

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: titulo,
      description: descripcion,
      url,
      // Sin fotos procesadas se cae a la imagen por defecto del sitio
      // (`app/opengraph-image.tsx`), que hereda del layout.
      images: fotosParaCompartir(listing),
    },
  };
}

export default function PropiedadPage({ params, searchParams }: PropsDeLaRuta) {
  return (
    <Suspense fallback={<p className="px-4 py-8">Cargando la propiedad…</p>}>
      <Ficha params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Ficha({
  params,
  searchParams,
}: {
  params: PropsDeLaRuta["params"];
  searchParams: PropsDeLaRuta["searchParams"];
}) {
  const { id: crudo, slug } = await params;

  // Un id no numérico es 404 sin tocar la red: `/propiedad/casa-linda` no es
  // una propiedad que falte, es una URL que no existe.
  const id = idDeParam(crudo);
  if (id === null) notFound();

  const [resultado, catalogo] = await Promise.all([getListing(id), getCatalog()]);

  if (!resultado.ok) return <FallaDeDatos failure={resultado.failure} />;

  // `null` es un resultado esperado (la propiedad no existe, o dejó de estar
  // publicada), no una falla: 404, no cartel de error.
  const listing = resultado.data;
  if (listing === null) notFound();

  // Dos URLs para el mismo contenido es contenido duplicado. El slug se
  // recalcula y si no coincide —un link viejo, o alguien editó la zona— se
  // redirige al canónico.
  const slugActual = (slug ?? []).join("/");
  if (slugActual !== slugDePropiedad(listing)) redirect(urlDePropiedad(listing));

  // Ver el comentario en TarjetaDePropiedad: la hora se lee una sola vez, acá,
  // después de declarar que esto se renderiza por request.
  await connection();
  const ahora = new Date();

  // La confirmación de la consulta viene por la URL (`?consulta=enviada`): la
  // action redirige acá después de crearla, que es lo que hace que se vea
  // también sin JavaScript.
  const query = await searchParams;
  const valorDeConsulta = query[PARAM_CONSULTA];
  const consultaEnviada =
    (Array.isArray(valorDeConsulta) ? valorDeConsulta[0] : valorDeConsulta) === CONSULTA_ENVIADA;

  const catalog = catalogo.ok ? catalogo.data : {};
  const titulo = tituloDePropiedad(listing);
  const siteUrl = getSiteUrl();
  // Los datos estructurados. El `url` va absoluto porque schema.org lo pide
  // así; sin SITE_URL se omite en vez de inventar un dominio.
  const jsonLd = jsonLdDePropiedad(
    listing,
    siteUrl === null ? null : `${siteUrl}${urlDePropiedad(listing)}`,
  );
  const expensas = formatearExpensas(listing.expenses);
  const ubicacion = textoDeUbicacion(listing.location);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      {/* Los datos estructurados, para que Google entienda qué es esta página
          en vez de deducirlo del texto. `jsonLdAHtml` escapa el "<": la
          descripción la escribe el CRM y un "</script>" ahí adentro cerraría
          la etiqueta. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdAHtml(jsonLd) }}
      />

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        <p>
          {listing.propertyTypeLabel} en {listing.conditionLabel.toLowerCase()}
        </p>
        {ubicacion === "" ? null : <p>{ubicacion}</p>}
        <p>{listing.location.fullAddress}</p>
        <p className="text-sm">
          <time dateTime={listing.createdAt.toISOString()}>
            {formatearPublicacion(listing.createdAt, ahora)}
          </time>
        </p>
      </header>

      <Galeria photos={listing.photos} titulo={titulo} />

      <section className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Precio</h2>
        {/* "por mes" cuando es alquiler: mostrar un alquiler como precio total
            es un error de lectura caro. */}
        <p className="text-xl font-semibold">
          {formatearPrecioPorMes(listing.price, listing.condition)}
        </p>
        {expensas === null ? null : <p>{expensas}</p>}
      </section>

      {/* `description` es nullable en la API. Sin descripción no va el bloque:
          el título compuesto y los atributos ya dicen qué es la propiedad. */}
      {listing.description === null || listing.description.trim() === "" ? null : (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Descripción</h2>
          {/* La descripción viene del CRM con saltos de línea, no con HTML:
              `whitespace-pre-line` los respeta sin interpretar etiquetas. */}
          <p className="whitespace-pre-line">{listing.description}</p>
        </section>
      )}

      {/* Los tres bloques pueden venir vacíos (sin strategy para ese tipo y
          condición): cada uno decide no dibujarse. */}
      <BloqueDeAtributos titulo="Características" atributos={listing.attributes} />
      <BloqueDeAtributos titulo="Amenities" atributos={listing.amenities} />
      <BloqueDeAtributos titulo="Cerca de la propiedad" atributos={listing.nearbyZones} />

      <MapaDePropiedad listing={listing} />

      <Enlaces listing={listing} />

      {/* La consulta por ESTA propiedad: `fuente: "propiedad_individual"` y el
          id, que la API exige en ese caso. */}
      {consultaEnviada ? (
        <ConsultaEnviada volverA={urlDePropiedad(listing)} />
      ) : (
        <FormularioDeConsulta
          fuente="propiedad_individual"
          listingId={listing.id}
          titulo="Consultar por esta propiedad"
          volverA={urlDePropiedad(listing)}
          descripcion={`Dejanos tus datos y te contactamos por ${titulo}.`}
        />
      )}

      <OtrosAvisos siblings={listing.siblingListings} catalog={catalog} />

      {/* Las relacionadas son una sección accesoria: si la lectura falla,
          degradan a nada (`attemptOr`) y la ficha se muestra igual. Van en su
          propio Suspense para no retrasar la ficha, que es lo que el visitante
          vino a ver. */}
      <Suspense fallback={null}>
        <Relacionadas id={listing.id} ahora={ahora} />
      </Suspense>
    </main>
  );
}

// El video y el tour 360 son links externos, no embeds: un iframe de YouTube en
// esta página carga más que toda la ficha, y el tour es de un tercero que
// cambia según la propiedad.
function Enlaces({ listing }: { listing: { videoUrl: string | null; tour360Url: string | null } }) {
  const enlaces = [
    { href: listing.videoUrl, texto: "Ver el video de la propiedad" },
    { href: listing.tour360Url, texto: "Ver el tour 360°" },
  ].filter((enlace): enlace is { href: string; texto: string } => enlace.href !== null);

  if (enlaces.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1">
      {enlaces.map((enlace) => (
        <li key={enlace.href}>
          <a href={enlace.href} target="_blank" rel="noopener noreferrer" className="underline">
            {enlace.texto}
          </a>
        </li>
      ))}
    </ul>
  );
}

async function Relacionadas({ id, ahora }: { id: number; ahora: Date }) {
  const relacionadas = await getRelatedListings(id);
  if (relacionadas.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Propiedades parecidas</h2>
      <ListadoDePropiedades listings={relacionadas} ahora={ahora} />
    </section>
  );
}
