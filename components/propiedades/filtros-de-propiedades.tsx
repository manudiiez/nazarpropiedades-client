import Link from "next/link";
import { aplicarFiltros } from "@/lib/actions/filtros";
import type { Catalog, Currency, Facets, ListingFilters } from "@/lib/domain";
import {
  EN_URL,
  OPCIONES_AMBIENTES,
  OPCIONES_ANTIGUEDAD,
  OPCIONES_BARRIO_CERRADO,
  OPCIONES_COCHERAS,
  OPCIONES_ORDEN,
  PARAMS,
  etiquetaDeSeccion,
  urlDelListado,
} from "@/lib/filters";
import { formatearEntero } from "@/lib/format";

// El formulario de filtros. Server Component: no hay estado de cliente, el
// submit es una Server Action y el estado del filtro vive en la URL.
//
// Las opciones salen de FACETS, no del catálogo (decisión del issue #32):
// facets es la verdad sobre lo que hay publicado, trae los `count`, y una zona
// que el CRM cargó con un slug que la API no tiene en su lista aparece en
// facets pero nunca en catalogs. El catálogo queda como respaldo para cuando la
// lectura de facets falla: es mejor un filtro sin conteos que ningún filtro.
//
// Las opciones con `count: 0` se muestran deshabilitadas CON su conteo, no se
// esconden: un combo cuyas opciones aparecen y desaparecen según el stock
// desorienta, y "Estación de servicio (0)" en gris informa que el sitio cubre
// esa categoría.

interface Opcion {
  valor: string;
  etiqueta: string;
  // `null` cuando no se sabe (facets caído): no se muestra "(0)", que sería
  // una afirmación falsa.
  count: number | null;
}

function conConteo(etiqueta: string, count: number | null): string {
  return count === null ? etiqueta : `${etiqueta} (${formatearEntero(count)})`;
}

function GrupoDeCasillas({
  nombre,
  titulo,
  opciones,
  seleccionados,
}: {
  nombre: string;
  titulo: string;
  opciones: Opcion[];
  seleccionados: string[];
}) {
  if (opciones.length === 0) return null;
  const elegidos = new Set(seleccionados);

  return (
    <fieldset className="border p-3">
      <legend className="text-sm font-semibold">{titulo}</legend>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {opciones.map((opcion) => (
          <li key={opcion.valor}>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                name={nombre}
                value={opcion.valor}
                defaultChecked={elegidos.has(opcion.valor)}
                // Deshabilitada, pero visible y con su conteo. Si venía
                // marcada en la URL no se deshabilita: hay que poder destildar
                // el filtro que dejó la lista en cero.
                disabled={opcion.count === 0 && !elegidos.has(opcion.valor)}
              />
              {conConteo(opcion.etiqueta, opcion.count)}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function Numero({
  nombre,
  etiqueta,
  valor,
  placeholder,
}: {
  nombre: string;
  etiqueta: string;
  valor: number | undefined;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col text-sm">
      {etiqueta}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        name={nombre}
        defaultValue={valor ?? ""}
        placeholder={placeholder}
        className="border px-2 py-1"
      />
    </label>
  );
}

function Seleccion({
  nombre,
  etiqueta,
  opciones,
  valor,
  vacio,
}: {
  nombre: string;
  etiqueta: string;
  opciones: Opcion[];
  valor: string | undefined;
  // La opción "no filtrar". Viaja como "" y el parseo la descarta por vacía.
  // Se omite donde no existe esa opción: el orden siempre tiene un valor, y
  // ofrecer un "sin orden" que en realidad es "más recientes" muestra la misma
  // opción dos veces.
  vacio?: string;
}) {
  return (
    <label className="flex flex-col text-sm">
      {etiqueta}
      <select name={nombre} defaultValue={valor ?? ""} className="border px-2 py-1">
        {vacio === undefined ? null : <option value="">{vacio}</option>}
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {conConteo(opcion.etiqueta, opcion.count)}
          </option>
        ))}
      </select>
    </label>
  );
}

function desdeFacets(entradas: Facets["propertyTypes"] | undefined): Opcion[] {
  return (entradas ?? []).map((entrada) => ({
    valor: entrada.value,
    etiqueta: entrada.label,
    count: entrada.count,
  }));
}

function desdeCatalogo(entradas: readonly { value: string; label: string }[] | undefined): Opcion[] {
  return (entradas ?? []).map((entrada) => ({
    valor: entrada.value,
    etiqueta: entrada.label,
    count: null,
  }));
}

function opcionesDeMoneda(facets: Facets | null): Opcion[] {
  // Solo las monedas con publicaciones activas: `priceRange` no trae las
  // vacías. Sin facets se ofrecen las dos.
  const monedas: Currency[] = facets === null
    ? ["USD", "ARS"]
    : (["USD", "ARS"] as const).filter((moneda) => facets.priceRange[moneda] !== undefined);

  return monedas.map((moneda) => ({
    valor: EN_URL.moneda(moneda),
    etiqueta: moneda,
    count: null,
  }));
}

export function FiltrosDePropiedades({
  filtros,
  facets,
  catalog,
  monedaForzada,
}: {
  filtros: ListingFilters;
  // `null` si la lectura de facets falló: el formulario se arma con el catálogo
  // y sin conteos, en vez de desaparecer.
  facets: Facets | null;
  catalog: Catalog;
  // La moneda que se agregó sola al ordenar por precio, para avisarlo donde se
  // eligió el orden en vez de dejar un filtro que el visitante no puso.
  monedaForzada: Currency | null;
}) {
  const operaciones = facets === null
    ? desdeCatalogo(catalog.conditions)
    : desdeFacets(facets.conditions);
  const tipos = facets === null
    ? desdeCatalogo(catalog.propertyTypes)
    : desdeFacets(facets.propertyTypes);

  // Las ubicaciones se van abriendo de a un nivel: provincia → departamentos de
  // esa provincia → zonas de los departamentos elegidos. Son 215 zonas: todas
  // juntas no son un filtro, son una pared. Y así funciona sin JavaScript,
  // porque cada submit vuelve con el nivel siguiente.
  const provincias = facets === null
    ? desdeCatalogo(catalog.provinces)
    : desdeFacets(facets.provinces);

  const provinciaElegida = facets?.provinces.find(
    (provincia) => provincia.value === filtros.province,
  );
  const provinciaDelCatalogo = catalog.provinces?.find(
    (provincia) => provincia.value === filtros.province,
  );

  const departamentos = provinciaElegida
    ? desdeFacets(provinciaElegida.departments)
    : desdeCatalogo(provinciaDelCatalogo?.departments);

  const elegidos = new Set(filtros.department ?? []);
  const zonas = (
    provinciaElegida?.departments.filter((departamento) => elegidos.has(departamento.value)) ?? []
  ).flatMap((departamento) =>
    departamento.zones.map((zona) => ({
      valor: zona.value,
      etiqueta: `${zona.label} — ${departamento.label}`,
      count: zona.count,
    })),
  );

  const amenities = catalog.amenities ?? [];
  // Las amenities NO están en facets (el endpoint no las trae), así que acá el
  // catálogo no es un respaldo: es la única fuente. Se agrupan por su sección.
  const secciones = [...new Set(amenities.map((amenity) => amenity.section))];

  return (
    <form action={aplicarFiltros} className="flex flex-col gap-3">
      <label className="flex flex-col text-sm">
        {/* "Dirección o barrio", NO "buscar": la API busca solo en barrio/calle
            y dirección, no en el título ni en la descripción. Un campo que diga
            "buscar" promete algo que no pasa. */}
        Dirección o barrio
        <input
          type="search"
          name={PARAMS.direccion}
          defaultValue={filtros.addressQuery ?? ""}
          placeholder="Ej.: Chacras de Coria, Viamonte"
          className="border px-2 py-1"
        />
      </label>

      <GrupoDeCasillas
        nombre={PARAMS.operacion}
        titulo="Operación"
        opciones={operaciones}
        seleccionados={(filtros.condition ?? []).map(EN_URL.operacion)}
      />

      <GrupoDeCasillas
        nombre={PARAMS.tipo}
        titulo="Tipo de propiedad"
        opciones={tipos}
        seleccionados={filtros.propertyType ?? []}
      />

      <fieldset className="flex flex-col gap-2 border p-3">
        <legend className="text-sm font-semibold">Ubicación</legend>
        <Seleccion
          nombre={PARAMS.provincia}
          etiqueta="Provincia"
          opciones={provincias}
          valor={filtros.province}
          vacio="Todas"
        />
        {/* Los departamentos aparecen recién con una provincia elegida, y las
            zonas con un departamento elegido. */}
        <GrupoDeCasillas
          nombre={PARAMS.departamento}
          titulo="Departamento"
          opciones={departamentos}
          seleccionados={filtros.department ?? []}
        />
        <GrupoDeCasillas
          nombre={PARAMS.zona}
          titulo="Zona"
          opciones={zonas}
          seleccionados={filtros.zone ?? []}
        />
      </fieldset>

      <fieldset className="flex flex-wrap items-end gap-3 border p-3">
        <legend className="text-sm font-semibold">Precio</legend>
        <Seleccion
          nombre={PARAMS.moneda}
          etiqueta="Moneda"
          opciones={opcionesDeMoneda(facets)}
          valor={filtros.currency === undefined ? undefined : EN_URL.moneda(filtros.currency)}
          vacio="Cualquiera"
        />
        {/* El rango publicado como placeholder: un mínimo de 300.000 cuando lo
            más caro vale 250.000 da una lista vacía sin explicación. */}
        <Numero
          nombre={PARAMS.precioMin}
          etiqueta="Desde"
          valor={filtros.priceMin}
          placeholder={minimoPublicado(facets, filtros.currency)}
        />
        <Numero
          nombre={PARAMS.precioMax}
          etiqueta="Hasta"
          valor={filtros.priceMax}
          placeholder={maximoPublicado(facets, filtros.currency)}
        />
      </fieldset>

      <fieldset className="flex flex-wrap items-end gap-3 border p-3">
        <legend className="text-sm font-semibold">Superficie total (m²)</legend>
        <Numero nombre={PARAMS.superficieMin} etiqueta="Desde" valor={filtros.totalAreaMin} />
        <Numero nombre={PARAMS.superficieMax} etiqueta="Hasta" valor={filtros.totalAreaMax} />
      </fieldset>

      <GrupoDeCasillas
        nombre={PARAMS.dormitorios}
        titulo="Dormitorios"
        opciones={OPCIONES_AMBIENTES.map((opcion) => ({ ...opcion, count: null }))}
        seleccionados={(filtros.bedrooms ?? []).map(EN_URL.ambientes)}
      />
      <GrupoDeCasillas
        nombre={PARAMS.banos}
        titulo="Baños"
        opciones={OPCIONES_AMBIENTES.map((opcion) => ({ ...opcion, count: null }))}
        seleccionados={(filtros.bathrooms ?? []).map(EN_URL.ambientes)}
      />
      <GrupoDeCasillas
        nombre={PARAMS.cocheras}
        titulo="Cocheras"
        opciones={OPCIONES_COCHERAS.map((opcion) => ({ ...opcion, count: null }))}
        seleccionados={(filtros.garageCapacity ?? []).map(EN_URL.cocheras)}
      />

      <Seleccion
        nombre={PARAMS.barrioCerrado}
        etiqueta="Barrio cerrado"
        opciones={OPCIONES_BARRIO_CERRADO.map((opcion) => ({ ...opcion, count: null }))}
        valor={
          filtros.gatedCommunity === undefined ? undefined : filtros.gatedCommunity ? "si" : "no"
        }
        vacio="Indiferente"
      />

      <GrupoDeCasillas
        nombre={PARAMS.antiguedad}
        titulo="Antigüedad"
        opciones={OPCIONES_ANTIGUEDAD.map((opcion) => ({ ...opcion, count: null }))}
        seleccionados={(filtros.age ?? []).map(EN_URL.antiguedad)}
      />

      {secciones.map((seccion) => (
        <GrupoDeCasillas
          key={seccion ?? "otras"}
          nombre={PARAMS.amenities}
          titulo={etiquetaDeSeccion(seccion)}
          opciones={desdeCatalogo(amenities.filter((amenity) => amenity.section === seccion))}
          seleccionados={filtros.amenities ?? []}
        />
      ))}

      <div className="flex flex-col gap-1">
        <Seleccion
          nombre={PARAMS.orden}
          etiqueta="Ordenar por"
          opciones={OPCIONES_ORDEN.map((opcion) => ({ ...opcion, count: null }))}
          valor={filtros.sort === undefined ? undefined : EN_URL.orden(filtros.sort)}
        />
        {/* La API ordena por precio sin convertir monedas, así que hay que fijar
            una o el orden mezcla pesos con dólares. Se avisa acá, al lado del
            control que lo provocó. */}
        {monedaForzada === null ? null : (
          <p className="text-sm">
            {`Para ordenar por precio hay que elegir una moneda: se está mostrando ${monedaForzada}.`}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="border px-4 py-2">
          Buscar
        </button>
        {/* Un link, no un reset: limpiar tiene que dejar la URL limpia, no el
            formulario en blanco con la lista filtrada detrás. */}
        <Link href={urlDelListado({ sort: filtros.sort })} className="border px-4 py-2">
          Limpiar
        </Link>
      </div>
    </form>
  );
}

function minimoPublicado(facets: Facets | null, currency: Currency | undefined): string | undefined {
  const rango = facets?.priceRange[currency ?? "USD"];
  return rango === undefined ? undefined : `Mínimo publicado: ${formatearEntero(rango.min)}`;
}

function maximoPublicado(facets: Facets | null, currency: Currency | undefined): string | undefined {
  const rango = facets?.priceRange[currency ?? "USD"];
  return rango === undefined ? undefined : `Máximo publicado: ${formatearEntero(rango.max)}`;
}
