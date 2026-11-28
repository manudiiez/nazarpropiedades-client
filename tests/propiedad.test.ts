import { describe, expect, it } from "vitest";
import {
  agruparPorSeccion,
  etiquetaDeSeccion,
  formatearValorDeAtributo,
  slugDePropiedad,
  textoDeUbicacion,
  tituloDePropiedad,
  urlDePropiedad,
  urlDePropiedadPorId,
} from "@/lib/format";
import type { AttributeItem, Listing, ListingSummary, Location } from "@/lib/domain";

const ubicacion = (parcial: Partial<Location> = {}): Location => ({
  province: "mendoza",
  provinceLabel: "Mendoza",
  department: "lujan_de_cuyo",
  departmentLabel: "Luján de Cuyo",
  zone: "chacras_de_coria",
  zoneLabel: "Chacras de Coria",
  neighborhoodOrStreet: "Viamonte 2300",
  fullAddress: "Viamonte 2300, Chacras de Coria, Luján de Cuyo, Mendoza",
  ...parcial,
});

// Solo los campos que estos formateadores leen: inventar un Listing completo
// acá haría el test ilegible y no probaría nada más.
const resumen = (parcial: Partial<ListingSummary> = {}): ListingSummary =>
  ({
    id: 7,
    propertyTypeLabel: "Casa",
    conditionLabel: "Venta",
    location: ubicacion(),
    ...parcial,
  }) as ListingSummary;

const ficha = (parcial: Partial<Listing> = {}): Listing =>
  ({ ...resumen(), title: null, ...parcial }) as Listing;

const atributo = (parcial: Partial<AttributeItem>): AttributeItem => ({
  key: "total_area",
  value: 620,
  label: "Superficie Total",
  suffix: "m²",
  section: "dimensions",
  ...parcial,
});

describe("título de una propiedad", () => {
  it("usa el título del CRM cuando hay uno", () => {
    expect(tituloDePropiedad(ficha({ title: "Casa con parque y piscina" }))).toBe(
      "Casa con parque y piscina",
    );
  });

  it("sin título compone uno con tipo, operación y zona", () => {
    // `title` es nullable en la API y la mayoría de las propiedades del CRM no
    // tiene: el título compuesto es el caso normal, no el excepcional.
    expect(tituloDePropiedad(ficha())).toBe("Casa en venta en Chacras de Coria");
    expect(tituloDePropiedad(ficha({ title: "   " }))).toBe("Casa en venta en Chacras de Coria");
  });

  it("sin zona cae al departamento, que siempre está", () => {
    const sinZona = ficha({ location: ubicacion({ zone: null, zoneLabel: null }) });
    expect(tituloDePropiedad(sinZona)).toBe("Casa en venta en Luján de Cuyo");
  });

  it("el listado no tiene título propio y compone el mismo texto que la ficha", () => {
    expect(tituloDePropiedad(resumen())).toBe("Casa en venta en Chacras de Coria");
  });
});

describe("ubicación legible", () => {
  it("va de lo más preciso a lo más general y saltea lo que falta", () => {
    expect(textoDeUbicacion(ubicacion())).toBe(
      "Viamonte 2300, Chacras de Coria, Luján de Cuyo",
    );
    expect(
      textoDeUbicacion(ubicacion({ neighborhoodOrStreet: null, zoneLabel: null, zone: null })),
    ).toBe("Luján de Cuyo");
  });
});

describe("slug y URL canónica", () => {
  it("el slug sale del título compuesto, nunca del título del CRM", () => {
    // Si dependiera de `title`, editarlo en el CRM cambiaría la URL de una
    // propiedad ya compartida e indexada.
    const conTitulo = ficha({ title: "Oportunidad única!! Casa en Chacras" });
    expect(slugDePropiedad(conTitulo)).toBe("casa-en-venta-en-chacras-de-coria");
  });

  it("sin acentos ni signos: el link se pega en WhatsApp", () => {
    const enLujan = ficha({ location: ubicacion({ zoneLabel: "Luján de Cuyo (Área Nueva)" }) });
    expect(slugDePropiedad(enLujan)).toBe("casa-en-venta-en-lujan-de-cuyo-area-nueva");
  });

  it("la URL canónica lleva el id y el slug", () => {
    expect(urlDePropiedad(ficha())).toBe("/propiedad/7/casa-en-venta-en-chacras-de-coria");
  });

  it("los otros avisos linkean solo con el id: la ficha redirige al canónico", () => {
    expect(urlDePropiedadPorId(12)).toBe("/propiedad/12");
  });
});

describe("secciones de atributos", () => {
  it("nombra las secciones conocidas de la API", () => {
    expect(etiquetaDeSeccion("dimensions")).toBe("Dimensiones");
    expect(etiquetaDeSeccion("amenities_comfort")).toBe("Confort");
  });

  it("una sección nueva no rompe nada: se degrada legible", () => {
    // La API agrega secciones cuando agrega strategies. Que se vea derivada es
    // la señal de que falta nombrarla.
    expect(etiquetaDeSeccion("pool_area")).toBe("Pool Area");
    expect(etiquetaDeSeccion(null)).toBe("Otros datos");
  });

  it("agrupa respetando el orden en que las secciones aparecen en la respuesta", () => {
    const grupos = agruparPorSeccion([
      atributo({ key: "total_area", section: "dimensions" }),
      atributo({ key: "bedrooms", section: "rooms", value: 3, suffix: null }),
      atributo({ key: "covered_area", section: "dimensions", value: 310 }),
      atributo({ key: "raro", section: null, value: "x", suffix: null }),
    ]);

    expect(grupos.map((grupo) => grupo.section)).toEqual(["dimensions", "rooms", null]);
    expect(grupos[0].atributos.map((a) => a.key)).toEqual(["total_area", "covered_area"]);
    expect(grupos[2].etiqueta).toBe("Otros datos");
  });
});

describe("valores de atributo que llegan como slug", () => {
  it("un enum de la API en crudo se muestra legible", () => {
    // La API manda `label` y `suffix` listos, pero el VALOR de algunos
    // atributos es el slug del enum y no hay endpoint que lo traduzca.
    expect(formatearValorDeAtributo("garage_doble")).toBe("Garage doble");
    expect(formatearValorDeAtributo("excelente")).toBe("Excelente");
  });

  it("lo que el CRM escribió a mano no se toca", () => {
    expect(formatearValorDeAtributo("Norte")).toBe("Norte");
    expect(formatearValorDeAtributo("Sobre calle principal")).toBe("Sobre calle principal");
  });
});
