---
description: Crea un commit siguiendo el formato Conventional Commits
argument-hint: [pista opcional sobre el tipo o alcance del cambio]
allowed-tools: Bash(git rev-parse:*), Bash(git init:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git check-ignore:*), Bash(git add:*), Bash(git commit:*)
---

Crea un commit de git con el formato [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/).

## Contexto

Cada comando termina en `|| true` para que un fallo (sin repositorio, sin commits) llegue como texto y no aborte el comando. Interprétalo según la sección "Casos especiales".

- ¿Es un repositorio git?: !`git rev-parse --is-inside-work-tree 2>&1 || true`
- ¿Existe un primer commit?: !`git rev-parse --verify HEAD 2>&1 || true`
- Estado: !`git status --short 2>&1 || true`
- Cambios en staging: !`git diff --cached 2>&1 || true`
- Cambios sin stage: !`git diff 2>&1 || true`
- Commits recientes (para ver el estilo): !`git log --oneline -10 2>&1 || true`

Pista del usuario (puede estar vacía): $ARGUMENTS

## Casos especiales

Compruébalos en este orden, antes de redactar nada.

1. **No es un repositorio git** (el contexto muestra `not a git repository`):
   - No ejecutes nada más y explícaselo al usuario.
   - Pregunta si quiere inicializarlo con `git init`. Solo lo ejecutas si confirma.
   - Tras inicializar, sigue con el caso 2 (el repositorio no tiene commits).
2. **Repositorio sin ningún commit** (`git rev-parse --verify HEAD` falla con `Needed a single revision` o similar; `git log` dice `does not have any commits yet`):
   - Es normal que `git log` y `git diff` contra `HEAD` no devuelvan nada: no es un error. Para ver qué entra, usa `git status --short` y `git diff --cached`.
   - Antes de añadir archivos, comprueba con `git check-ignore` que `.env` y `node_modules` están ignorados. Si alguno no lo está, avisa y detente: no los incluyas ni los commitees.
   - Todo el proyecto aparece como archivos sin seguimiento. Añádelos por nombre o por directorio (por ejemplo `src`, `docs`, `package.json`, `package-lock.json`, `.gitignore`, `.env.example`, `CLAUDE.md`, `.claude`), nunca con `git add -A` ni `git add .`.
   - Si el usuario no da otra pista, el mensaje del primer commit es `chore: commit inicial` (o `feat: ...` si describe mejor lo que hay, como una API ya funcional). Sin cuerpo salvo que aporte algo.
3. **Sin cambios** (ni en staging, ni sin stage, ni archivos sin seguimiento): díselo al usuario y no hagas nada más.
4. **Fallo de `git commit`** por falta de identidad (`user.name` / `user.email`): indícale que ejecute `git config user.name` y `git config user.email`. No los configures tú ni toques la configuración de git.

## Formato

```
<tipo>(<alcance opcional>): <descripción>

[cuerpo opcional]

[pie opcional]
```

Tipos permitidos:

- `feat`: nueva funcionalidad
- `fix`: corrección de un error
- `docs`: solo documentación
- `style`: formato que no afecta al comportamiento (espacios, comas, etc.)
- `refactor`: cambio de código que no corrige un error ni añade funcionalidad
- `perf`: mejora de rendimiento
- `test`: añadir o corregir tests
- `build`: sistema de build o dependencias
- `ci`: configuración de integración continua
- `chore`: tareas de mantenimiento que no tocan `src` ni tests
- `revert`: revierte un commit anterior

## Reglas

1. Si hay cambios en staging, commitea solo esos. Si no hay nada en staging, añade con `git add` los archivos relevantes por nombre (nunca `git add -A` ni `git add .`) y no incluyas `.env` ni secretos.
2. Si los cambios mezclan varios propósitos independientes, propón dividirlos en varios commits.
3. El alcance es opcional; usa la capa o módulo afectado cuando aporte claridad (`auth`, `routes`, `services`, `repositories`, `config`...).
4. La descripción va en español, en imperativo, en minúscula, sin punto final y con un máximo de ~72 caracteres.
5. Usa la tool `AskUserQuestion` para mostrarle al usuario el mensaje del commit y decida que le parece bien. Si te da ok continua, si te dice que no propon otro mensaje y vuelve a preguntarle.
6. Añade cuerpo solo si el *porqué* no es evidente; explica motivo, no lista de archivos.
7. Cambio incompatible: añade `!` tras el tipo/alcance (`feat(auth)!: ...`) y un pie `BREAKING CHANGE: ...`.
8. Pasa el mensaje con `git commit -m` (usa varios `-m` para cuerpo y pies). Si hay una instrucción de atribución vigente para commits, añádela como último pie.
9. No hagas `git push`, no uses `--amend` ni `--no-verify`.
10. Al terminar, muestra el hash y el mensaje del commit creado.
