import type { PortfolioWork } from "./types";

/**
 * TRABAJOS DE EJEMPLO. Se reemplazan por el portfolio en la base en la Fase 2.4.
 * Las fotos son recortes de capturas de Instagram de @tattoobyesti (no versionadas,
 * ver .gitignore); títulos y categorías son provisorios.
 * Se muestran en el workspace DEMO_WORKS_SLUG.
 */
export const DEMO_WORKS_SLUG = "esti";

function work(
  id: string,
  title: string,
  category: string,
  bodyZone: string | null,
  alt: string,
): PortfolioWork {
  return {
    id,
    title,
    category,
    bodyZone,
    description: null,
    image: { src: `/demo/${id}.jpg`, alt, width: 800, height: 1000 },
  };
}

export const DEMO_WORKS: PortfolioWork[] = [
  work("cristo-antebrazo", "Cristo con corona de espinas", "Religioso", "Antebrazo", "Rostro de Cristo con corona de espinas y manos en oración, en negro y gris."),
  work("japones-paisaje", "Paisaje japonés con torii", "Oriental", "Brazo", "Paisaje con torii, montañas y una figura meditando junto al agua."),
  work("virgen-rosario", "Virgen con rosario", "Religioso", "Brazo", "Virgen con lágrima y rosario entre las manos."),
  work("caballero-espalda", "Caballero en armadura", "Figurativo", "Espalda", "Caballero medieval sentado con armadura detallada, en proceso."),
  work("tigre", "Tigre", "Animales", "Antebrazo", "Tigre rugiendo de frente, en negro y gris."),
  work("buda", "Buda", "Oriental", "Brazo", "Rostro de Buda sereno con símbolo om y fondo de puntillismo."),
  work("virgen-rostro", "Virgen", "Religioso", "Brazo", "Rostro de virgen con manto, mirando hacia arriba."),
  work("pagoda-antebrazo", "Pagoda", "Oriental", "Antebrazo", "Pagoda japonesa entre pinos y nubes."),
  work("ojo-mano", "Mirada entre los dedos", "Figurativo", null, "Ojo que asoma entre los dedos de una mano con una cruz."),
  work("virgen-brazo", "Virgen dolorosa", "Religioso", "Brazo", "Virgen con corona de espinas sosteniendo un rosario."),
  work("angel-brazo", "Ángel", "Religioso", "Brazo", "Figura de ángel con alas en una manga en negro y gris."),
];
