/**
 * Guía de técnica original (redactada para esta app) y alternativas por ejercicio.
 * Las ilustraciones son esquemas animados originales (ver components/ExerciseIllustration).
 * No se incluyen enlaces externos inventados: la persona puede añadir su propio
 * video o enlace autorizado en cada ejercicio.
 */
import type { Mode } from './plan';

export type Pattern =
  | 'squat'
  | 'sumo'
  | 'hinge'
  | 'bridge'
  | 'lunge'
  | 'plank'
  | 'sidePlank'
  | 'deadBug'
  | 'row'
  | 'floorPress'
  | 'shoulderPress'
  | 'curl'
  | 'stepUp'
  | 'calfRaise'
  | 'lateralRaise'
  | 'kickback'
  | 'pushUp'
  | 'abduction';

export interface Alternative {
  id: string;
  name: string;
  why: string;
  mode: Mode;
}

export interface ExerciseGuide {
  pattern: Pattern;
  muscles: string;
  setup: string[];
  steps: string[];
  cues: string[];
  mistakes: string[];
  alternatives: Alternative[];
  /** Señales de alerta específicas. */
  caution?: string;
}

export const GUIDE: Record<string, ExerciseGuide> = {
  'goblet-squat': {
    pattern: 'squat',
    muscles: 'Cuádriceps, glúteos, core',
    setup: ['Pies a la anchura de caderas o un poco más, puntas ligeramente hacia fuera.', 'Sostén una mancuerna vertical pegada al pecho, codos hacia abajo.'],
    steps: ['Inhala y lleva la cadera atrás y abajo como para sentarte.', 'Baja hasta donde mantengas la espalda neutra y los talones apoyados.', 'Empuja el suelo con todo el pie y sube exhalando.'],
    cues: ['Rodillas en la dirección de los pies', 'Pecho orgulloso', 'Peso repartido en todo el pie'],
    mistakes: ['Rodillas que se juntan hacia dentro', 'Talones que se levantan', 'Redondear la espalda al bajar'],
    alternatives: [
      { id: 'box-squat', name: 'Sentadilla a caja/silla', why: 'Controla la profundidad y da confianza.', mode: 'held' },
      { id: 'bw-squat', name: 'Sentadilla sin peso', why: 'Para practicar técnica o si hay molestias.', mode: 'body' },
      { id: 'split-squat-assisted', name: 'Sentadilla dividida con apoyo', why: 'Menor carga total en la espalda.', mode: 'each' },
    ],
  },
  'romanian-deadlift': {
    pattern: 'hinge',
    muscles: 'Isquiotibiales, glúteos, espalda baja (estabilidad)',
    setup: ['De pie, pies a la anchura de caderas, una mancuerna en cada mano frente a los muslos.', 'Rodillas ligeramente flexionadas y fijas.'],
    steps: ['Empuja la cadera hacia atrás deslizando las mancuernas cerca de las piernas.', 'Baja hasta sentir estiramiento en la parte posterior del muslo, sin redondear la espalda.', 'Aprieta glúteos y vuelve a la posición de pie.'],
    cues: ['Cadera atrás, no abajo', 'Mancuernas rozando las piernas', 'Cuello alineado con la espalda'],
    mistakes: ['Convertirlo en sentadilla', 'Redondear la zona lumbar', 'Bajar más de lo que permite la flexibilidad'],
    alternatives: [
      { id: 'hip-hinge-bw', name: 'Bisagra de cadera con palo/escoba', why: 'Aprende el patrón sin carga.', mode: 'body' },
      { id: 'single-leg-rdl-supported', name: 'Peso muerto a una pierna con apoyo', why: 'Menos carga, más control.', mode: 'one' },
      { id: 'glute-bridge-alt', name: 'Puente de glúteo', why: 'Si la espalda baja está sensible.', mode: 'held' },
    ],
    caution: 'Si sientes dolor en la espalda baja, detente. No es un ejercicio para "aguantar" molestias.',
  },
  'glute-bridge': {
    pattern: 'bridge',
    muscles: 'Glúteo mayor (principal), isquiotibiales',
    setup: [
      'Puente: boca arriba en el suelo, rodillas dobladas, pies a la anchura de caderas.',
      'Hip thrust: parte alta de la espalda apoyada en el borde de un sofá estable.',
      'Una mancuerna sobre la cadera (sobre una toalla doblada), sujeta con ambas manos.',
    ],
    steps: ['Exhala y empuja con los talones elevando la cadera.', 'Arriba, aprieta glúteos 1–2 s con la barbilla recogida y sin arquear la zona lumbar.', 'Baja en 2–3 s.'],
    cues: ['Costillas abajo', 'Empuja con talones', 'Pausa arriba', 'Tibias verticales arriba'],
    mistakes: ['Arquear la espalda en lugar de extender la cadera', 'Pies demasiado lejos', 'Rebotar abajo'],
    alternatives: [
      { id: 'bw-bridge', name: 'Puente sin peso con pausa de 3 s', why: 'Para técnica o recuperación.', mode: 'body' },
      { id: 'single-leg-bridge-alt', name: 'Puente a una pierna', why: 'Más intensidad sin más peso.', mode: 'body' },
      { id: 'frog-pump', name: 'Frog pumps (plantas juntas)', why: 'Muchas repeticiones para glúteo con poco material.', mode: 'body' },
    ],
  },
  'reverse-lunge': {
    pattern: 'lunge',
    muscles: 'Glúteos, cuádriceps, estabilidad',
    setup: ['De pie, pies a la anchura de caderas. Mancuernas a los lados (o sin peso).', 'Ten cerca una pared o silla si necesitas equilibrio.'],
    steps: ['Da un paso largo hacia atrás y baja la rodilla trasera hacia el suelo.', 'Mantén el torso erguido y el peso en la pierna delantera.', 'Empuja con el pie delantero para volver.'],
    cues: ['Paso largo y controlado', 'Rodilla delantera sobre el pie', 'Torso alto'],
    mistakes: ['Paso demasiado corto', 'Rodilla delantera que cae hacia dentro', 'Perder el equilibrio por ir rápido'],
    alternatives: [
      { id: 'split-squat-static', name: 'Sentadilla dividida estática', why: 'Menos equilibrio requerido.', mode: 'each' },
      { id: 'assisted-lunge', name: 'Zancada con apoyo en pared', why: 'Más estabilidad.', mode: 'body' },
      { id: 'step-up-alt', name: 'Subida a escalón bajo', why: 'Si la zancada molesta la rodilla.', mode: 'each' },
    ],
  },
  'front-plank': {
    pattern: 'plank',
    muscles: 'Core (abdomen profundo), hombros',
    setup: ['Antebrazos en el suelo, codos bajo los hombros.', 'Piernas extendidas (o rodillas apoyadas para facilitar).'],
    steps: ['Forma una línea recta de cabeza a talones.', 'Aprieta glúteos y lleva el ombligo suavemente hacia dentro.', 'Respira de forma continua durante 20–40 s.'],
    cues: ['Línea recta', 'Respira, no contengas', 'Empuja el suelo con antebrazos'],
    mistakes: ['Cadera hundida', 'Cadera demasiado alta', 'Contener la respiración'],
    alternatives: [
      { id: 'knee-plank', name: 'Plancha con rodillas apoyadas', why: 'Versión más accesible.', mode: 'body' },
      { id: 'incline-plank', name: 'Plancha inclinada (manos en mesa)', why: 'Menos carga en hombros y core.', mode: 'body' },
    ],
  },
  'single-arm-row': {
    pattern: 'row',
    muscles: 'Dorsales, romboides, bíceps',
    setup: ['Apoya una mano y una rodilla en un banco/silla, o inclínate con mano en la rodilla.', 'Espalda neutra, mancuerna colgando bajo el hombro.'],
    steps: ['Lleva el codo hacia la cadera, cerca del cuerpo.', 'Aprieta la escápula hacia atrás 1 segundo.', 'Baja con control hasta estirar el brazo.'],
    cues: ['Codo hacia el bolsillo', 'Hombro lejos de la oreja', 'Torso quieto'],
    mistakes: ['Girar el torso para subir', 'Tirar con la mano en lugar del codo', 'Encoger el hombro'],
    alternatives: [
      { id: 'band-row', name: 'Remo con banda elástica', why: 'Sin mancuernas o si hay molestias.', mode: 'body' },
      { id: 'chest-supported-row', name: 'Remo con pecho apoyado en banco inclinado', why: 'Protege la espalda baja.', mode: 'each' },
    ],
  },
  'floor-press': {
    pattern: 'floorPress',
    muscles: 'Pectoral, tríceps, hombro anterior',
    setup: ['Acostada en el suelo, rodillas dobladas.', 'Mancuernas sobre el pecho, codos a ~45° del torso.'],
    steps: ['Empuja las mancuernas hacia arriba hasta extender los brazos.', 'Baja con control hasta que los tríceps toquen suavemente el suelo.', 'Pausa breve y repite.'],
    cues: ['Codos a 45°', 'Muñecas firmes', 'Tríceps tocan suave'],
    mistakes: ['Codos abiertos a 90°', 'Dejar caer los codos', 'Muñecas dobladas hacia atrás'],
    alternatives: [
      { id: 'incline-pushup-alt', name: 'Flexión inclinada', why: 'Sin peso, mismo patrón.', mode: 'body' },
      { id: 'band-press', name: 'Press con banda', why: 'Alternativa sin mancuernas.', mode: 'body' },
    ],
  },
  'shoulder-press': {
    pattern: 'shoulderPress',
    muscles: 'Hombros, tríceps, core',
    setup: ['Sentada o de pie, mancuernas a la altura de los hombros, palmas al frente o neutras.', 'Costillas abajo, glúteos activos.'],
    steps: ['Empuja hacia arriba sin arquear la espalda.', 'Termina con brazos casi extendidos junto a las orejas.', 'Baja con control a la altura de los hombros.'],
    cues: ['Costillas abajo', 'Empuja hacia el techo', 'Control al bajar'],
    mistakes: ['Arquear la zona lumbar', 'Bloquear codos con golpe', 'Subir los hombros hacia las orejas'],
    alternatives: [
      { id: 'seated-press', name: 'Press sentada con respaldo', why: 'Más estabilidad para la espalda.', mode: 'each' },
      { id: 'landmine-style', name: 'Press a un brazo alternado', why: 'Menos carga simultánea.', mode: 'each' },
      { id: 'pike-wall', name: 'Elevación frontal ligera', why: 'Si el press molesta el hombro (menos rango).', mode: 'each' },
    ],
    caution: 'Si sientes pinchazo en el hombro, reduce rango o carga y detente si persiste.',
  },
  'biceps-curl': {
    pattern: 'curl',
    muscles: 'Bíceps, antebrazo',
    setup: ['De pie, mancuernas a los lados, palmas al frente.', 'Codos pegados al torso.'],
    steps: ['Flexiona los codos subiendo las mancuernas sin mover los hombros.', 'Aprieta arriba.', 'Baja lento (2–3 s).'],
    cues: ['Codos quietos', 'Sin balanceo', 'Bajada lenta'],
    mistakes: ['Balancear el cuerpo', 'Adelantar los codos', 'Dejar caer el peso'],
    alternatives: [
      { id: 'band-curl', name: 'Curl con banda', why: 'Sin mancuernas.', mode: 'body' },
      { id: 'alt-curl', name: 'Curl alterno', why: 'Más control por brazo.', mode: 'each' },
    ],
  },
  'dead-bug': {
    pattern: 'deadBug',
    muscles: 'Core profundo, coordinación',
    setup: ['Boca arriba, brazos hacia el techo, rodillas a 90° sobre la cadera.', 'Zona lumbar suavemente apoyada en el suelo.'],
    steps: ['Extiende brazo y pierna contrarios lentamente sin despegar la espalda baja.', 'Exhala al extender.', 'Vuelve al centro y cambia de lado.'],
    cues: ['Espalda baja pegada', 'Movimiento lento', 'Exhala al extender'],
    mistakes: ['Arquear la espalda', 'Ir demasiado rápido', 'Contener la respiración'],
    alternatives: [
      { id: 'heel-taps', name: 'Toques de talón', why: 'Versión más sencilla.', mode: 'body' },
      { id: 'bird-dog', name: 'Bird dog (cuadrupedia)', why: 'Alternativa en cuatro apoyos.', mode: 'body' },
    ],
  },
  'sumo-squat': {
    pattern: 'sumo',
    muscles: 'Glúteos, aductores, cuádriceps',
    setup: ['Pies más anchos que los hombros, puntas hacia fuera.', 'Sostén una mancuerna vertical entre las piernas con ambas manos.'],
    steps: ['Baja llevando las rodillas hacia fuera, en línea con los pies.', 'Mantén el torso erguido.', 'Sube empujando el suelo y apretando glúteos.'],
    cues: ['Rodillas hacia fuera', 'Torso alto', 'Sube con glúteos'],
    mistakes: ['Rodillas hacia dentro', 'Inclinar demasiado el torso', 'Postura demasiado amplia para tu movilidad'],
    alternatives: [
      { id: 'goblet-squat-alt', name: 'Sentadilla goblet', why: 'Postura más estrecha y familiar.', mode: 'held' },
      { id: 'box-sumo', name: 'Sentadilla sumo a caja', why: 'Controla la profundidad.', mode: 'held' },
    ],
  },
  'step-up': {
    pattern: 'stepUp',
    muscles: 'Glúteos, cuádriceps, equilibrio',
    setup: ['Escalón bajo y estable (15–30 cm).', 'Mancuernas a los lados o sin peso; apoyo cerca si lo necesitas.'],
    steps: ['Apoya todo el pie en el escalón.', 'Empuja con esa pierna para subir sin impulsarte con la de abajo.', 'Baja con control y completa las reps de un lado.'],
    cues: ['Todo el pie arriba', 'Empuja con la pierna de arriba', 'Baja lento'],
    mistakes: ['Impulsarse con la pierna de abajo', 'Rodilla hacia dentro', 'Escalón demasiado alto'],
    alternatives: [
      { id: 'lower-step', name: 'Escalón más bajo', why: 'Si hay molestia de rodilla.', mode: 'body' },
      { id: 'reverse-lunge-alt', name: 'Zancada hacia atrás', why: 'Patrón similar.', mode: 'each' },
    ],
  },
  'calf-raise': {
    pattern: 'calfRaise',
    muscles: 'Gemelos y sóleo',
    setup: ['De pie, mancuernas a los lados, apoyo ligero en pared si lo necesitas.', 'Opcional: puntas en un escalón para más recorrido.'],
    steps: ['Sube sobre las puntas lo más alto posible.', 'Pausa 1 segundo arriba.', 'Baja lento.'],
    cues: ['Sube alto', 'Pausa', 'Baja en 2–3 s'],
    mistakes: ['Rebotar', 'Rango corto', 'Tobillos que se van hacia fuera'],
    alternatives: [
      { id: 'single-calf', name: 'Elevación a una pierna con apoyo', why: 'Más intensidad sin más peso.', mode: 'body' },
      { id: 'seated-calf', name: 'Elevación sentada con peso en rodillas', why: 'Si el equilibrio es difícil.', mode: 'held' },
    ],
  },
  'side-plank': {
    pattern: 'sidePlank',
    muscles: 'Oblicuos, glúteo medio, hombro',
    setup: ['De lado, antebrazo apoyado bajo el hombro.', 'Rodillas dobladas (más fácil) o piernas extendidas.'],
    steps: ['Eleva la cadera formando una línea recta.', 'Mantén 15–30 s respirando.', 'Cambia de lado.'],
    cues: ['Cadera alta', 'Hombro lejos de la oreja', 'Respira'],
    mistakes: ['Cadera caída', 'Rotar el torso', 'Contener la respiración'],
    alternatives: [
      { id: 'knee-side-plank', name: 'Plancha lateral con rodillas', why: 'Versión accesible.', mode: 'body' },
      { id: 'wall-side-plank', name: 'Plancha lateral de pie contra pared', why: 'Si el hombro molesta.', mode: 'body' },
    ],
  },
  'bent-over-row': {
    pattern: 'row',
    muscles: 'Espalda media, dorsales, bíceps',
    setup: ['Bisagra de cadera con rodillas suaves, espalda neutra.', 'Mancuernas colgando bajo los hombros.'],
    steps: ['Lleva los codos hacia atrás, cerca del cuerpo.', 'Aprieta escápulas 1 segundo.', 'Baja con control.'],
    cues: ['Espalda neutra', 'Codos atrás', 'Torso quieto'],
    mistakes: ['Levantar el torso al tirar', 'Redondear la espalda', 'Encoger hombros'],
    alternatives: [
      { id: 'single-arm-row-alt', name: 'Remo a una mano con apoyo', why: 'Protege la espalda baja.', mode: 'each' },
      { id: 'band-row-alt', name: 'Remo con banda', why: 'Sin mancuernas.', mode: 'body' },
    ],
  },
  'lateral-raise': {
    pattern: 'lateralRaise',
    muscles: 'Deltoides lateral',
    setup: ['De pie, mancuernas ligeras a los lados, codos levemente flexionados.'],
    steps: ['Eleva los brazos hacia los lados hasta la altura de los hombros.', 'Pausa breve.', 'Baja lento.'],
    cues: ['Lidera con los codos', 'Hasta la altura del hombro', 'Sin impulso'],
    mistakes: ['Subir por encima del hombro con impulso', 'Encoger el cuello', 'Usar demasiado peso'],
    alternatives: [
      { id: 'band-lateral', name: 'Elevación lateral con banda', why: 'Tensión más suave.', mode: 'body' },
      { id: 'seated-lateral', name: 'Elevación lateral sentada', why: 'Evita balanceo.', mode: 'each' },
    ],
  },
  'triceps-kickback': {
    pattern: 'kickback',
    muscles: 'Tríceps',
    setup: ['Bisagra de cadera (o apoyo en banco), codos pegados al torso y altos.'],
    steps: ['Extiende el codo llevando la mancuerna hacia atrás.', 'Aprieta el tríceps arriba.', 'Vuelve con control sin mover el hombro.'],
    cues: ['Brazo superior quieto', 'Extiende completo', 'Lento'],
    mistakes: ['Balancear el brazo', 'Bajar el codo', 'Usar impulso'],
    alternatives: [
      { id: 'overhead-ext', name: 'Extensión de tríceps sobre la cabeza', why: 'Mayor estiramiento.', mode: 'held' },
      { id: 'bench-dip-assisted', name: 'Fondos en silla con pies cerca', why: 'Peso corporal (solo si los hombros están cómodos).', mode: 'body' },
    ],
  },
  'hammer-curl': {
    pattern: 'curl',
    muscles: 'Bíceps, braquial, antebrazo',
    setup: ['De pie, mancuernas a los lados con palmas mirando al cuerpo.'],
    steps: ['Flexiona codos manteniendo la palma neutra.', 'Aprieta arriba.', 'Baja en 2–3 s.'],
    cues: ['Palmas enfrentadas', 'Codos quietos', 'Sin balanceo'],
    mistakes: ['Balanceo', 'Adelantar los codos', 'Bajada rápida'],
    alternatives: [
      { id: 'cross-hammer', name: 'Curl martillo cruzado', why: 'Variante de agarre.', mode: 'each' },
      { id: 'band-hammer', name: 'Curl con banda', why: 'Sin mancuernas.', mode: 'body' },
    ],
  },
  'incline-push-up': {
    pattern: 'pushUp',
    muscles: 'Pectoral, tríceps, core',
    setup: ['Manos en una mesa, encimera o pared, un poco más anchas que los hombros.', 'Cuerpo en línea recta.'],
    steps: ['Baja el pecho hacia el borde con codos a ~45°.', 'Empuja hasta extender los brazos.', 'Mantén el core firme.'],
    cues: ['Cuerpo como tabla', 'Codos a 45°', 'Pecho al borde'],
    mistakes: ['Cadera hundida', 'Codos muy abiertos', 'Rango corto'],
    alternatives: [
      { id: 'wall-push-up', name: 'Flexión en pared', why: 'Más fácil.', mode: 'body' },
      { id: 'knee-push-up', name: 'Flexión con rodillas', why: 'Más difícil que la inclinada.', mode: 'body' },
    ],
  },
  'split-squat': {
    pattern: 'lunge',
    muscles: 'Glúteos, cuádriceps, aductores, estabilidad',
    setup: ['Empeine del pie trasero sobre un sofá o silla estable (o en el suelo para la versión fácil).', 'Pie delantero un paso largo por delante; mancuernas a los lados si las usas.'],
    steps: ['Baja recto hacia abajo con el torso ligeramente inclinado hacia delante (más glúteo).', 'La rodilla trasera se acerca al suelo.', 'Empuja con todo el pie delantero para subir.'],
    cues: ['Peso en el pie delantero', 'Torso un poco adelante', 'Bajada en 3 s'],
    mistakes: ['Pie delantero demasiado cerca', 'Empujar con la pierna de atrás', 'Rodilla delantera hacia dentro'],
    alternatives: [
      { id: 'split-squat-floor', name: 'Sentadilla dividida con el pie trasero en el suelo', why: 'Menos equilibrio y menos exigencia.', mode: 'each' },
      { id: 'step-up-alt2', name: 'Subida a escalón bajo', why: 'Si la búlgara molesta la rodilla.', mode: 'each' },
      { id: 'reverse-lunge-alt2', name: 'Zancada hacia atrás', why: 'Patrón similar.', mode: 'each' },
    ],
  },
  'single-leg-bridge': {
    pattern: 'bridge',
    muscles: 'Glúteo mayor y medio (unilateral)',
    setup: ['Boca arriba, una rodilla doblada con el pie apoyado y la otra pierna estirada o recogida al pecho.', 'Si usas peso: una mancuerna sobre la cadera del lado que trabaja, sujeta con ambas manos.'],
    steps: ['Empuja con el talón apoyado y eleva la cadera sin que se incline hacia un lado.', 'Pausa 1–2 s arriba.', 'Baja controlando; termina un lado y cambia.'],
    cues: ['Cadera nivelada', 'Talón empuja', 'Pausa arriba'],
    mistakes: ['Cadera que rota', 'Arquear la espalda', 'Ir rápido'],
    alternatives: [
      { id: 'bridge-two-legs', name: 'Puente a dos piernas con pausa', why: 'Versión más fácil.', mode: 'body' },
      { id: 'b-stance-bridge', name: 'Puente con postura escalonada (B-stance)', why: 'Paso intermedio entre dos y una pierna.', mode: 'body' },
    ],
  },
  'side-lying-abduction': {
    pattern: 'abduction',
    muscles: 'Glúteo medio y menor',
    setup: ['Tumbada de lado, cabeza apoyada en el brazo, pierna de abajo doblada.', 'Pierna de arriba estirada, en línea con el cuerpo, punta del pie mirando al frente.'],
    steps: ['Eleva la pierna de arriba ligeramente hacia atrás, sin girar la cadera.', 'Pausa 1 s arriba.', 'Baja en 2–3 s sin apoyar del todo.'],
    cues: ['Talón lidera', 'Cadera apilada', 'Lento'],
    mistakes: ['Girar la punta hacia el techo', 'Llevar la pierna hacia delante', 'Usar impulso'],
    alternatives: [
      { id: 'clamshell', name: 'Almeja (clamshell)', why: 'Versión más fácil.', mode: 'body' },
      { id: 'standing-abduction', name: 'Abducción de pie con apoyo', why: 'Si tumbarte de lado es incómodo.', mode: 'body' },
    ],
  },
  'single-leg-rdl': {
    pattern: 'hinge',
    muscles: 'Glúteos, isquiotibiales, estabilidad de cadera',
    setup: ['De pie junto a una pared o silla para apoyar una mano.', 'Mancuerna en la mano contraria a la pierna de apoyo (o sin peso).'],
    steps: ['Lleva la cadera atrás mientras la pierna libre se estira hacia atrás.', 'Baja con la espalda neutra hasta sentir el estiramiento en la pierna de apoyo.', 'Vuelve apretando el glúteo de la pierna de apoyo.'],
    cues: ['Cadera cuadrada al suelo', 'Rodilla de apoyo suave', 'Apoyo ligero, no te cuelgues'],
    mistakes: ['Abrir la cadera hacia un lado', 'Redondear la espalda', 'Bajar más de lo que controlas'],
    alternatives: [
      { id: 'kickstand-rdl', name: 'Peso muerto con pie de apoyo atrás (kickstand)', why: 'Más estable.', mode: 'one' },
      { id: 'rdl-two-legs', name: 'Peso muerto rumano a dos piernas', why: 'Si el equilibrio limita.', mode: 'each' },
    ],
    caution: 'Si notas molestia en la espalda baja, reduce el recorrido o usa la versión a dos piernas.',
  },
};

export const WARMUP_STEPS = [
  { name: 'Marcha en el sitio', seconds: 60 },
  { name: 'Círculos de brazos y hombros', seconds: 45 },
  { name: 'Bisagras de cadera sin peso', seconds: 45 },
  { name: 'Sentadillas sin peso lentas', seconds: 60 },
  { name: 'Zancadas atrás alternas sin peso', seconds: 45 },
  { name: 'Gato-camello / movilidad de columna', seconds: 45 },
];

export function getGuide(exerciseId: string): ExerciseGuide | undefined {
  return GUIDE[exerciseId];
}
