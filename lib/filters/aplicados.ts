import type { Catalog, ListingFilters } from "@/lib/domain";
import { buildLabelIndex, labelFor } from "@/lib/data/http/label-index";
import { formatearEntero, formatearSuperficie, prefijoDeMoneda } from "@/lib/format";
import {
  OPCIONES_AMBIENTES,
  OPCIONES_ANTIGUEDAD,
  OPCIONES_BARRIO_CERRADO,
  OPCIONES_COCHERAS,
  type OpcionDeFiltro,
} from "./opciones";
import { PARAMS } from "./url";

// Los filtros aplicados, en texto y con la versión de los filtros SIN cada uno.
//
// Hace falta para dos pantallas distintas, y por eso no vive en un componente:
//
//  - la lista vacía, donde el visitante tiene que poder ver qué pidió para
//    saber qué soltar ("no encontramos nada" sin decir qué se buscó obliga a
//    leer la URL);
//  - el encabezado de los resultados, donde cada filtro se puede quitar de a
//    uno con un link.
//
// `filtrosSin` es el objeto de filtros sin ese valor, listo para pasarle a
// `searchParamsDesdeFiltros`: así el link de quitar se arma con la misma
// traducción que todo lo demás y no concatenando strings.
//
// Se importa `label-index` —que vive en lib/data/http— a propósito: es una
// función pura sobre el catálogo, sin red ni repositorios. La regla de no
// importar de `lib/data/http` es sobre las lecturas, no sobre esto.

export interface FiltroAplicado {
  // El param de la URL al que corresponde. Sirve de `key` y permite agrupar.
  param: string;
  // Qué filtro es: "Operación", "Zona".
  etiqueta: string;
  // El valor, ya legible: "Venta", "Chacras de Coria", "USD 320.000".
  valor: string;
  filtrosSin: ListingFilters;
}

type Clave = keyof ListingFilters;

// Quitar UN valor de un filtro multi-valor. Si era el último, se borra la clave
// entera: `{propertyType: []}` y `{}` tienen que dar la misma URL.
//
// Los casts son por la clave dinámica: TS no puede probar que el array
// filtrado es del tipo de esa clave. Lo garantiza el origen, que es el mismo
// array.
function sinLista(filtros: ListingFilters, clave: Clave, valor: unknown): ListingFilters {
  const resto = (filtros[clave] as unknown[]).filter((actual) => actual !== valor);
  const salida: Record<string, unknown> = { ...filtros };
  if (resto.length === 0) delete salida[clave];
  else salida[clave] = resto;
  return salida as ListingFilters;
}

function sinClave(filtros: ListingFilters, clave: Clave): ListingFilters {
  const salida: ListingFilters = { ...filtros };
  delete salida[clave];
  return salida;
}

function etiquetaDeOpcion<T>(opciones: OpcionDeFiltro<T>[], dominio: T): string {
  return opciones.find((opcion) => opcion.dominio === dominio)?.etiqueta ?? String(dominio);
}

// Un precio sin moneda elegida se muestra sin símbolo, pero diciéndolo: el
// filtro de la API compara el número contra cualquier moneda, así que poner
// "USD" acá sería mentir sobre lo que se buscó.
function precio(monto: number, filtros: ListingFilters): string {
  if (filtros.currency === undefined) return `${formatearEntero(monto)} (cualquier moneda)`;
  return `${prefijoDeMoneda(filtros.currency)} ${formatearEntero(monto)}`;
}

export function filtrosAplicados(
  filtros: ListingFilters,
  catalog: Catalog = {},
): FiltroAplicado[] {
  const labels = buildLabelIndex(catalog);
  const lista: FiltroAplicado[] = [];

  const agregar = (param: string, etiqueta: string, valor: string, filtrosSin: ListingFilters) => {
    lista.push({ param, etiqueta, valor, filtrosSin });
  };

  const deLista = <T,>(
    clave: Clave,
    param: string,
    etiqueta: string,
    valores: T[] | undefined,
    texto: (valor: T) => string,
  ) => {
    for (const valor of valores ?? []) {
      agregar(param, etiqueta, texto(valor), sinLista(filtros, clave, valor));
    }
  };

  deLista("condition", PARAMS.operacion, "Operación", filtros.condition, (valor) =>
    labelFor(labels.conditions, valor),
  );
  deLista("propertyType", PARAMS.tipo, "Tipo", filtros.propertyType, (valor) =>
    labelFor(labels.propertyTypes, valor),
  );

  if (filtros.province !== undefined) {
    agregar(
      PARAMS.provincia,
      "Provincia",
      labelFor(labels.provinces, filtros.province),
      // Quitar la provincia sin quitar sus departamentos y zonas dejaría
      // filtros que no se pueden ni mostrar ni volver a elegir en el
      // formulario, que muestra los departamentos de la provincia elegida.
      sinClave(sinClave(sinClave(filtros, "province"), "department"), "zone"),
    );
  }

  deLista("department", PARAMS.departamento, "Departamento", filtros.department, (valor) =>
    labelFor(labels.departments, valor),
  );
  deLista("zone", PARAMS.zona, "Zona", filtros.zone, (valor) => labelFor(labels.zones, valor));

  if (filtros.currency !== undefined) {
    agregar(PARAMS.moneda, "Moneda", filtros.currency, sinClave(filtros, "currency"));
  }
  if (filtros.priceMin !== undefined) {
    agregar(
      PARAMS.precioMin,
      "Precio desde",
      precio(filtros.priceMin, filtros),
      sinClave(filtros, "priceMin"),
    );
  }
  if (filtros.priceMax !== undefined) {
    agregar(
      PARAMS.precioMax,
      "Precio hasta",
      precio(filtros.priceMax, filtros),
      sinClave(filtros, "priceMax"),
    );
  }
  if (filtros.totalAreaMin !== undefined) {
    agregar(
      PARAMS.superficieMin,
      "Superficie desde",
      formatearSuperficie(filtros.totalAreaMin) ?? "",
      sinClave(filtros, "totalAreaMin"),
    );
  }
  if (filtros.totalAreaMax !== undefined) {
    agregar(
      PARAMS.superficieMax,
      "Superficie hasta",
      formatearSuperficie(filtros.totalAreaMax) ?? "",
      sinClave(filtros, "totalAreaMax"),
    );
  }

  deLista("bedrooms", PARAMS.dormitorios, "Dormitorios", filtros.bedrooms, (valor) =>
    etiquetaDeOpcion(OPCIONES_AMBIENTES, valor),
  );
  deLista("bathrooms", PARAMS.banos, "Baños", filtros.bathrooms, (valor) =>
    etiquetaDeOpcion(OPCIONES_AMBIENTES, valor),
  );
  deLista("garageCapacity", PARAMS.cocheras, "Cocheras", filtros.garageCapacity, (valor) =>
    etiquetaDeOpcion(OPCIONES_COCHERAS, valor),
  );

  if (filtros.gatedCommunity !== undefined) {
    agregar(
      PARAMS.barrioCerrado,
      "Barrio cerrado",
      etiquetaDeOpcion(OPCIONES_BARRIO_CERRADO, filtros.gatedCommunity),
      sinClave(filtros, "gatedCommunity"),
    );
  }

  deLista("age", PARAMS.antiguedad, "Antigüedad", filtros.age, (valor) =>
    etiquetaDeOpcion(OPCIONES_ANTIGUEDAD, valor),
  );
  deLista("amenities", PARAMS.amenities, "Amenity", filtros.amenities, (valor) =>
    labelFor(labels.amenities, valor),
  );

  const direccion = filtros.addressQuery?.trim();
  if (direccion !== undefined && direccion !== "") {
    agregar(PARAMS.direccion, "Dirección o barrio", direccion, sinClave(filtros, "addressQuery"));
  }

  return lista;
}

// `sort` no entra en la lista de arriba a propósito: el orden no es un filtro,
// no reduce resultados y ofrecer "quitar: Más recientes" en la lista vacía
// manda al visitante a tocar lo único que no va a cambiar nada.
export function hayFiltrosAplicados(filtros: ListingFilters): boolean {
  return filtrosAplicados(filtros).length > 0;
}
