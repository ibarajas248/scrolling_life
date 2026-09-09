from __future__ import annotations

from datetime import date
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import html


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "Logic Dream explicacion conceptual y tecnica.docx"


def esc(text: object) -> str:
    return html.escape(str(text), quote=False)


def text_runs(text: str, bold: bool = False) -> str:
    props = "<w:rPr><w:b/></w:rPr>" if bold else ""
    preserve = ' xml:space="preserve"' if text[:1].isspace() or text[-1:].isspace() else ""
    return f"<w:r>{props}<w:t{preserve}>{esc(text)}</w:t></w:r>"


def p(text: str = "", style: str | None = None, align: str | None = None, bold: bool = False) -> str:
    ppr = []
    if style:
        ppr.append(f'<w:pStyle w:val="{style}"/>')
    if align:
        ppr.append(f'<w:jc w:val="{align}"/>')
    ppr_xml = f"<w:pPr>{''.join(ppr)}</w:pPr>" if ppr else ""
    return f"<w:p>{ppr_xml}{text_runs(text, bold=bold) if text else ''}</w:p>"


def mixed_p(parts: list[tuple[str, bool]], style: str | None = None) -> str:
    ppr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
    return f"<w:p>{ppr}{''.join(text_runs(t, b) for t, b in parts)}</w:p>"


def bullet(text: str) -> str:
    return (
        '<w:p><w:pPr><w:pStyle w:val="ListParagraph"/>'
        '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>'
        f"{text_runs(text)}</w:p>"
    )


def page_break() -> str:
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def cell(text: str, shade: str | None = None, bold: bool = False) -> str:
    shd = f'<w:shd w:fill="{shade}"/>' if shade else ""
    color = '<w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr>' if bold and shade else ("<w:rPr><w:b/></w:rPr>" if bold else "")
    return (
        "<w:tc><w:tcPr>"
        '<w:tcW w:w="2400" w:type="dxa"/>'
        "<w:tcBorders>"
        '<w:top w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>'
        '<w:left w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>'
        '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>'
        '<w:right w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>'
        "</w:tcBorders>"
        f"{shd}<w:vAlign w:val=\"center\"/><w:tcMar>"
        '<w:top w:w="120" w:type="dxa"/><w:left w:w="120" w:type="dxa"/>'
        '<w:bottom w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/>'
        "</w:tcMar></w:tcPr>"
        f"<w:p><w:r>{color}<w:t>{esc(text)}</w:t></w:r></w:p></w:tc>"
    )


def table(rows: list[list[str]], widths: list[int] | None = None) -> str:
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in (widths or [2400] * len(rows[0])))
    out = [
        "<w:tbl><w:tblPr>"
        '<w:tblW w:w="0" w:type="auto"/>'
        '<w:tblLook w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>'
        "</w:tblPr>"
        f"<w:tblGrid>{grid}</w:tblGrid>"
    ]
    for ri, row in enumerate(rows):
        out.append("<w:tr>")
        for item in row:
            out.append(cell(item, "1F4E79" if ri == 0 else None, bold=ri == 0))
        out.append("</w:tr>")
    out.append("</w:tbl>")
    return "".join(out) + p()


sections = []
sections.append(p("Logic Dream explicacion conceptual y tecnica", "Title"))
sections.append(p("Documento de lectura para entender la obra, la interfaz y el modelo generativo local", "Subtitle"))
sections.append(p(f"Preparado para el proyecto local Scrolling Life. Fecha: {date.today().strftime('%Y-%m-%d')}."))
sections.append(p("Logic Dream es una pieza web y un laboratorio visual que muestra una pequena inteligencia generativa funcionando dentro del navegador. La pagina no llama a una API externa para producir el texto: carga pesos entrenados, ejecuta un Transformer pequeno en JavaScript y escribe caracter por caracter. Su valor conceptual esta en hacer visible una tension: la maquina parece sonar, pero ese sueno es una cadena de calculos numericos, probabilidades y memoria limitada."))
sections.append(p("El objetivo de este documento es explicar la pieza en dos niveles. Primero, como obra de net art: que significa la consola, el texto infinito, la estetica retro BIOS y los graficos tecnicos. Segundo, como sistema tecnico: que archivos la componen, que datos usa, como procesa cada caracter y que partes de la visualizacion son calculos reales del modelo."))

sections.append(p("Resumen ejecutivo", "Heading1"))
for item in [
    "La pagina genera texto de manera local, dentro del navegador, usando pesos incluidos en el proyecto.",
    "El modelo trabaja a nivel de caracteres, no de palabras completas. Cada nuevo caracter se vuelve parte del contexto para calcular el siguiente.",
    "Los graficos de la derecha muestran estados tecnicos reales de la inferencia: atencion, logits, probabilidades, vectores, activaciones, contexto y entropia.",
    "La experiencia actual esta orientada a una lectura artistica: una consola de texto infinita a la izquierda y graficos tecnicos cambiantes a la derecha.",
    "La obra no demuestra conciencia, intencion ni comprension humana. Produce continuidad textual por patrones aprendidos y muestreo probabilistico.",
]:
    sections.append(bullet(item))

sections.append(p("Lectura conceptual", "Heading1"))
sections.append(p("Logic Dream funciona como una ventana teatral al interior de un modelo generativo. La pantalla no presenta al usuario una caja de chat tradicional, sino una maquina que ya esta escribiendo. La ausencia de un campo de instrucciones visible cambia la relacion con la IA: el usuario no manda una orden, observa un proceso. La pieza convierte la inferencia en escena."))
sections.append(p("La consola infinita es importante porque desplaza la idea de respuesta cerrada. En un chatbot comun esperamos una contestacion, un final, una utilidad. Aqui el texto insiste, se alarga y se recicla. Esa continuidad expone un rasgo central de muchos modelos generativos: no producen una verdad completa de una sola vez, sino una secuencia de decisiones locales. El siguiente signo depende del contexto disponible y de una distribucion de posibilidades."))
sections.append(p("La estetica BIOS retro no es solo decoracion. Remite a una cultura visual de sistemas operativos tempranos, monitores CRT, arranque de maquina y diagnostico tecnico. Esa capa visual sugiere que estamos viendo una inteligencia todavia material, electronica, dependiente de memoria, matrices y tiempo de calculo. El azul fluorescente hace que la pagina parezca un instrumento o una consola de laboratorio, no una aplicacion comercial pulida."))
sections.append(p("La obra tambien juega con una paradoja. El texto dice que la maquina suena, observa, recuerda o deja rastros. Pero la propia interfaz muestra que esos verbos poeticos estan sostenidos por numeros. Lo poetico y lo tecnico no se cancelan: conviven. El proyecto no oculta el mecanismo, lo vuelve parte de la experiencia estetica."))

sections.append(p("Como funciona para el visitante", "Heading1"))
sections.append(p("Al entrar a la URL logic-dream, la pagina carga tres piezas principales: los datos del modelo, el motor de inferencia y la interfaz. Una semilla textual inicial queda definida internamente. Luego el navegador calcula el primer paso, escoge un caracter, lo agrega al texto visible y repite el ciclo sin limite configurado."))
sections.append(p("La vista actual se divide en dos zonas. A la izquierda aparece el texto que se escribe. A la derecha aparecen graficos tecnicos del proceso. Mientras el texto crece, esos graficos cambian entre diferentes modos para mostrar que la generacion no es una animacion vacia: cada paso recalcula estado interno, probabilidades y activaciones."))
sections.append(table([
    ["Zona de la interfaz", "Funcion"],
    ["Texto que se escribe", "Muestra la semilla y los caracteres generados en vivo. El scroll acompana el crecimiento del texto."],
    ["Graficos tecnicos", "Rota entre vistas del estado real del modelo: atencion, logits, probabilidades, vectores, operaciones, contexto, activaciones y entropia."],
    ["Barra inferior", "Permite pausar, generar un caracter, reiniciar, cambiar velocidad y mantener el limite infinito."],
], [2600, 6200]))

sections.append(p("Arquitectura tecnica del modelo", "Heading1"))
sections.append(p("El modelo se llama Microtexto 01. Es un Transformer decoder only, pequeno y entrenado para predecir el siguiente caracter. Usa posiciones aprendidas, atencion causal, dos bloques Transformer, normalizacion previa a cada subcapa, una red feed forward con ReLU y una cabeza final que convierte el estado interno en logits para el vocabulario."))
sections.append(table([
    ["Propiedad", "Valor en Logic Dream"],
    ["Tipo de modelo", "Transformer decoder only a nivel de caracteres"],
    ["Contexto", "64 posiciones"],
    ["Dimension interna", "64 componentes"],
    ["Capas", "2 bloques Transformer"],
    ["Cabezas de atencion", "4 por capa"],
    ["Dimension por cabeza", "16 componentes"],
    ["Feed forward", "64 a 128 a 64 con ReLU"],
    ["Vocabulario", "37 caracteres"],
    ["Parametros entrenados", "75.941"],
    ["Entrenamiento", "2.600 pasos, batch 32"],
    ["Tokens presentados", "5.324.800 caracteres"],
], [2600, 6200]))

sections.append(p("Flujo de una generacion", "Heading1"))
sections.append(p("Cada caracter nuevo nace de una cadena precisa. Primero, el texto visible y la semilla interna se normalizan. Despues, el modelo toma solo los ultimos 64 caracteres, porque esa es su ventana de contexto. Cada caracter se convierte en un identificador del vocabulario. Luego ese identificador se transforma en un vector de 64 numeros mediante una tabla de embeddings. A ese vector se le suma una posicion aprendida para que el modelo distinga, por ejemplo, un caracter al inicio de la ventana de uno al final."))
sections.append(p("El vector entra a dos bloques Transformer. En cada bloque ocurre una normalizacion, se calculan Q, K y V, se aplica atencion causal para que una posicion solo mire hacia atras, se mezcla la informacion contextual y se pasa por una red feed forward. Al final, una normalizacion y una capa lineal producen un logit para cada caracter posible. Los logits son puntajes sin normalizar. La funcion softmax los convierte en probabilidades. Con temperatura y top k se decide cuanto azar queda disponible. Finalmente, un muestreador elige un caracter y lo anade al texto."))
for item in [
    "Texto actual y semilla interna.",
    "Normalizacion a caracteres conocidos.",
    "Recorte a los ultimos 64 caracteres.",
    "Conversion de caracteres a IDs del vocabulario.",
    "Embedding mas posicion aprendida.",
    "Dos bloques Transformer con atencion causal.",
    "Logits para los 37 caracteres posibles.",
    "Softmax, temperatura, top k y muestreo.",
    "Nuevo caracter visible y reinicio del ciclo.",
]:
    sections.append(bullet(item))

sections.append(p("Que significan los graficos", "Heading1"))
sections.append(p("Los graficos de la derecha son lecturas tecnicas del estado real de inferencia. No son una fotografia del hardware fisico del computador, ni una prueba de que el modelo tenga pensamientos. Son representaciones visuales de numeros que el propio motor JavaScript calcula mientras genera texto."))
sections.append(table([
    ["Grafico", "Que muestra", "Por que importa"],
    ["Atencion", "Pesos softmax entre consultas Q y claves K dentro del contexto causal.", "Permite ver que posiciones del texto influyen mas en una posicion actual."],
    ["Probabilidades", "Caracteres candidatos ordenados por probabilidad despues del softmax.", "Muestra que la salida no aparece de la nada: se escoge desde una distribucion."],
    ["Vectores", "Componentes numericos del embedding, posicion y senales Q K V.", "Traduce letras a numeros manipulables por matrices."],
    ["Operaciones", "Productos x_i por w_i y sumas internas.", "Hace visible que una red neuronal tambien es algebra repetida muchas veces."],
    ["Logits", "Puntajes previos al softmax para todo el vocabulario.", "Distingue puntaje bruto de probabilidad final."],
    ["Entropia", "Incertidumbre de la distribucion en pasos recientes.", "Ayuda a ver cuando el modelo esta seguro o abierto a varias opciones."],
    ["Contexto", "Caracteres e IDs que entran en la ventana de 64 posiciones.", "Aclara la memoria limitada del sistema."],
    ["Activaciones", "Muestras de senales internas por capa.", "Ensenan como circula informacion numerica dentro del modelo."],
], [1600, 3900, 3500]))

sections.append(p("Lo real y lo simulado", "Heading1"))
sections.append(p("En Logic Dream conviene separar tres niveles. El primero es real tecnicamente: el modelo, sus pesos, sus logits, su atencion, sus probabilidades y sus activaciones se calculan en el navegador. El segundo es representacional: los graficos traducen esos numeros a imagenes para que una persona pueda leerlos. El tercero es poetico: palabras como sueno, memoria o observacion pertenecen a la interpretacion estetica, no a una afirmacion de conciencia."))
sections.append(table([
    ["Elemento", "Es real", "Aclaracion"],
    ["Generacion de texto", "Si", "La produce el Transformer local cargado en JavaScript."],
    ["Pesos del modelo", "Si", "Estan incluidos en model-data.js como datos entrenados."],
    ["Atencion y logits", "Si", "Se calculan para el contexto actual en cada paso."],
    ["Graficos tecnicos", "Si, como visualizacion", "Representan valores reales, pero no son una imagen literal del hardware."],
    ["Circuitos cuantizados", "Didactico si estan visibles", "Pueden explicar una operacion con bits, pero no participan en la generacion real."],
    ["Que la maquina suene", "Metafora", "Es una lectura artistica del comportamiento generativo, no una propiedad mental."],
], [2100, 1700, 5200]))

sections.append(p("Archivos principales", "Heading1"))
sections.append(p("La implementacion esta concentrada en una carpeta local. El HTML organiza la experiencia, el CSS define la estetica net art y BIOS, el motor ejecuta la inferencia y el archivo de datos contiene la arquitectura declarada, el vocabulario, los metadatos de entrenamiento y los pesos."))
sections.append(table([
    ["Archivo", "Papel"],
    ["logic-dream/index.html", "Estructura de la pagina, zonas visibles, controles y contenedores de salida."],
    ["logic-dream/src/app.js", "Estado de la interfaz, bucle de escritura infinita, rotacion de graficos y conexion entre UI y modelo."],
    ["logic-dream/src/engine.js", "Motor matematico: normalizacion, embeddings, atencion, capas lineales, softmax, muestreo y utilidades numericas."],
    ["logic-dream/src/model-data.js", "Datos entrenados: configuracion, vocabulario, metadatos, formas de tensores, pesos y curva de entrenamiento."],
    ["logic-dream/src/styles.css", "Sistema visual, layout, modo netart, consola azul retro y estilos responsivos."],
], [3200, 5600]))

sections.append(p("Limitaciones tecnicas y conceptuales", "Heading1"))
sections.append(p("El modelo es deliberadamente pequeno. Esto lo vuelve comprensible y ejecutable en el navegador, pero limita su capacidad. No es comparable con un gran modelo conversacional. Trabaja con caracteres, tiene una ventana de contexto corta y fue entrenado con un corpus sintetico pequeno sobre imagen, memoria y tecnologia. Por eso puede producir frases sugerentes, pero tambien repeticiones, incoherencias y asociaciones pobres."))
sections.append(p("La perdida de validacion baja no debe leerse como dominio general del espanol. La validacion proviene de la misma distribucion de plantillas, de modo que el modelo puede estar aprendiendo patrones de esa familia textual. La pieza no busca resolver lenguaje natural en general; busca mostrar el mecanismo de una generacion local y convertirlo en experiencia visual."))
sections.append(p("Desde lo conceptual, esta limitacion es una virtud. La obra no vende una inteligencia omnisciente. Expone una maquina finita, entrenada, situada, parcial. La fragilidad del texto y la repeticion son parte de su lenguaje artistico."))

sections.append(p("Como explicar Logic Dream en una presentacion", "Heading1"))
sections.append(p("Una forma clara de presentarlo es decir que Logic Dream es una obra web que convierte una inferencia de IA en paisaje visual. A la izquierda vemos el efecto: texto que aparece sin detenerse. A la derecha vemos rastros del mecanismo: probabilidades, atencion, activaciones y memoria contextual. La obra pregunta que pasa cuando dejamos de ver la IA como respuesta y empezamos a verla como proceso."))
sections.append(p("Si el publico es tecnico, conviene enfatizar que el modelo corre localmente, que cada paso reinyecta el caracter generado y que los graficos provienen de tensores reales. Si el publico es artistico, conviene enfatizar la consola, la temporalidad infinita, la estetica de diagnostico y la friccion entre poesia y calculo."))
sections.append(p("Frase breve sugerida", "Heading2"))
sections.append(p("Logic Dream es una pieza de net art que muestra una IA pequena escribiendo sin fin: el texto aparece como sueno, pero el sueno se revela como atencion, logits, vectores y probabilidades calculadas en tiempo real."))

sections.append(p("Glosario", "Heading1"))
sections.append(table([
    ["Termino", "Explicacion"],
    ["Caracter", "Unidad minima que el modelo predice: una letra, espacio, salto de linea o signo."],
    ["Token", "En esta pieza, practicamente equivale a un caracter codificado como ID."],
    ["Embedding", "Vector aprendido que convierte un ID en numeros."],
    ["Atencion causal", "Mecanismo que permite mirar caracteres anteriores, pero no futuros."],
    ["Logit", "Puntaje bruto antes de convertirse en probabilidad."],
    ["Softmax", "Funcion que transforma logits en una distribucion de probabilidades."],
    ["Temperatura", "Parametro que aplana o concentra la distribucion antes de muestrear."],
    ["Entropia", "Medida de incertidumbre de una distribucion."],
    ["Activacion", "Valor interno producido por una capa durante la inferencia."],
], [2200, 6600]))

sections.append(p("Cierre", "Heading1"))
sections.append(p("Logic Dream no intenta ocultar la distancia entre lenguaje y calculo. Al contrario, la pone en escena. Su texto infinito funciona como superficie poetica, mientras los graficos insisten en que cada signo visible esta sostenido por operaciones numericas. Esa doble lectura es el centro de la pieza: una maquina local, limitada y matematica que produce una forma de imaginacion visual sin necesidad de fingir conciencia."))


styles_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="150" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/><w:color w:val="222222"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Subtitle"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="220"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="40"/><w:color w:val="000000"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="24"/><w:color w:val="444444"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="420" w:after="140"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="30"/><w:color w:val="000000"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="260" w:after="100"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="25"/><w:color w:val="000000"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720" w:hanging="360"/><w:spacing w:after="90"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="21"/></w:rPr></w:style>
</w:styles>"""

numbering_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>"""

document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {''.join(sections)}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1200" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>"""

content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""

rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

doc_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>"""

core = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Logic Dream explicacion conceptual y tecnica</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{date.today().isoformat()}T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{date.today().isoformat()}T00:00:00Z</dcterms:modified>
</cp:coreProperties>"""

app = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex</Application>
</Properties>"""

with ZipFile(OUT, "w", ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", content_types)
    z.writestr("_rels/.rels", rels)
    z.writestr("word/_rels/document.xml.rels", doc_rels)
    z.writestr("word/document.xml", document_xml)
    z.writestr("word/styles.xml", styles_xml)
    z.writestr("word/numbering.xml", numbering_xml)
    z.writestr("docProps/core.xml", core)
    z.writestr("docProps/app.xml", app)

print(OUT)
