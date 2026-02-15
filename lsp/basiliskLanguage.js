"use strict";
/**
 * Basilisk C Language Definition
 *
 * This module defines the Basilisk C language constructs, keywords, types,
 * and provides documentation for hover information and code completion.
 *
 * Basilisk C is an extension of C99 designed for computational fluid dynamics
 * simulations. It adds domain-specific constructs for grid operations, field
 * manipulation, and parallel computing.
 *
 * Reference: http://basilisk.fr/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOCUMENTATION = exports.COMMON_HEADERS = exports.MPI_KEYWORDS = exports.BOUNDARY_DIRECTIONS = exports.LOOP_VARIABLES = exports.CONSTANTS = exports.BUILTIN_FUNCTIONS = exports.GRID_TYPES = exports.FIELD_TYPES = exports.CONTROL_KEYWORDS = void 0;
exports.createCompletionItems = createCompletionItems;
exports.getHoverDocumentation = getHoverDocumentation;
exports.isBasiliskKeyword = isBasiliskKeyword;
exports.getKeywordCategory = getKeywordCategory;
const vscode_languageserver_1 = require("vscode-languageserver");
/**
 * Basilisk control flow keywords - iteration and event constructs
 */
exports.CONTROL_KEYWORDS = [
    'event',
    'foreach',
    'foreach_face',
    'foreach_boundary',
    'foreach_vertex',
    'foreach_dimension',
    'foreach_level',
    'foreach_leaf',
    'foreach_neighbor',
    'foreach_cell',
    'foreach_child',
    'foreach_block',
    'foreach_blockf',
    'foreach_block_inner',
    'foreach_point',
    'foreach_cache',
    'foreach_cache_level',
    'foreach_stencil',
    'reduction'
];
/**
 * Basilisk field types - scalar and vector field declarations
 */
exports.FIELD_TYPES = [
    'scalar',
    'vector',
    'tensor',
    'face',
    'vertex',
    'symmetric',
    'coord',
    'point'
];
/**
 * Basilisk grid types
 */
exports.GRID_TYPES = [
    'Grid',
    'Boundary',
    'Tree',
    'Quadtree',
    'Octree',
    'Point',
    'Cell'
];
/**
 * Common Basilisk functions and macros
 */
exports.BUILTIN_FUNCTIONS = [
    // Simulation control
    'run',
    'init_grid',
    'free_grid',
    'cartesian',
    'quadtree',
    'octree',
    'multigrid',
    // Field operations
    'new',
    'delete',
    'normalize',
    'statsf',
    'normf',
    'change',
    // Solvers
    'diffusion',
    'poisson',
    'project',
    'advection',
    'viscosity',
    'mg_solve',
    // Adaptation
    'adapt_wavelet',
    'refine',
    'unrefine',
    'coarsen',
    // Output
    'output_ppm',
    'output_gfs',
    'output_vtu',
    'output_field',
    'output_facets',
    'dump',
    'restore',
    // Math/utility
    'noise',
    'interpolate',
    'pid',
    'npe',
    'clamp',
    'fabs',
    'sq',
    'cube',
    'sign',
    'max',
    'min',
    // Boundary conditions
    'dirichlet',
    'neumann',
    'periodic',
    'symmetry',
    // Geometry
    'fraction',
    'curvature',
    'height',
    'facet_normal',
    'embed_gradient',
    // Parallel
    'mpi_all_reduce',
    'mpi_boundary_update'
];
/**
 * Basilisk constants and special variables
 */
exports.CONSTANTS = [
    'PI',
    'M_PI',
    'HUGE',
    'nodata',
    'true',
    'false',
    'NULL',
    'BGHOSTS',
    'GHOSTS',
    'TRASH',
    'N',
    'L0',
    'X0',
    'Y0',
    'Z0',
    'DT',
    'TOLERANCE',
    'NITERMAX',
    'NITERMIN'
];
/**
 * Special Basilisk variables accessible in foreach loops
 */
exports.LOOP_VARIABLES = [
    'x', 'y', 'z', // Cell center coordinates
    'Delta', // Cell size
    'level', // Refinement level
    'depth', // Tree depth
    't', // Current time
    'dt', // Time step
    'i', // Iteration count
    'point', // Current point/cell
    'child', // Child iterator
    'neighbor', // Neighbor iterator
    'left', 'right', // Boundary directions
    'top', 'bottom',
    'front', 'back',
    'fm', 'cm', 'cs' // Metric terms
];
/**
 * Boundary condition directions
 */
exports.BOUNDARY_DIRECTIONS = [
    'left',
    'right',
    'top',
    'bottom',
    'front',
    'back'
];
/**
 * MPI-related keywords
 */
exports.MPI_KEYWORDS = [
    'MPI_Allreduce',
    'MPI_Barrier',
    'MPI_Bcast',
    'MPI_Comm',
    'MPI_Comm_rank',
    'MPI_Comm_size',
    'MPI_Finalize',
    'MPI_Gather',
    'MPI_Init',
    'MPI_Recv',
    'MPI_Reduce',
    'MPI_Scatter',
    'MPI_Send',
    'MPI_DOUBLE',
    'MPI_INT',
    'MPI_FLOAT',
    'MPI_COMM_WORLD',
    'MPI_SUM',
    'MPI_MAX',
    'MPI_MIN'
];
/**
 * Common Basilisk include headers
 */
exports.COMMON_HEADERS = [
    // Core
    'run.h',
    'utils.h',
    'events.h',
    'common.h',
    // Grid
    'grid/cartesian.h',
    'grid/quadtree.h',
    'grid/octree.h',
    'grid/multigrid.h',
    'grid/multigrid-mpi.h',
    'grid/tree.h',
    'grid/bitree.h',
    // Solvers
    'poisson.h',
    'diffusion.h',
    // Navier-Stokes
    'navier-stokes/centered.h',
    'navier-stokes/perfs.h',
    // Two-phase flow
    'two-phase.h',
    'vof.h',
    'tension.h',
    'reduced.h',
    'tracer.h',
    // Other physics
    'embed.h',
    'curvature.h',
    'fractions.h',
    'conservation.h',
    // Output/visualization
    'view.h',
    'output.h',
    'draw.h'
];
exports.DOCUMENTATION = {
    // Control flow
    'foreach': {
        signature: 'foreach() { ... }',
        description: 'Iterates over all cells in the grid. This is the primary iteration construct in Basilisk for performing operations on scalar and vector fields.',
        example: `foreach()
  f[] = x*x + y*y;`,
        seeAlso: ['foreach_face', 'foreach_vertex', 'foreach_boundary']
    },
    'foreach_face': {
        signature: 'foreach_face([x|y|z]) { ... }',
        description: 'Iterates over all faces in the specified direction. Without an argument, iterates over all faces. Face-centered values are accessed using the face iterator.',
        example: `face vector u[];
foreach_face(x)
  u.x[] = 1.0;`,
        seeAlso: ['foreach', 'face']
    },
    'foreach_vertex': {
        signature: 'foreach_vertex() { ... }',
        description: 'Iterates over all vertices (cell corners) in the grid. Useful for vertex-centered schemes.',
        example: `vertex scalar psi[];
foreach_vertex()
  psi[] = x*y;`,
        seeAlso: ['foreach', 'vertex']
    },
    'foreach_boundary': {
        signature: 'foreach_boundary(direction) { ... }',
        description: 'Iterates over all boundary cells in the specified direction (left, right, top, bottom, front, back).',
        example: `foreach_boundary(left)
  u.x[] = 0;`,
        seeAlso: ['dirichlet', 'neumann']
    },
    'foreach_dimension': {
        signature: 'foreach_dimension() { ... }',
        description: 'Replicates the code block for each spatial dimension. Variables x, y, z are automatically permuted.',
        example: `foreach_dimension()
  u.x[] = 0;  // Sets u.x, u.y, u.z to 0`,
        seeAlso: ['foreach']
    },
    'foreach_neighbor': {
        signature: 'foreach_neighbor([stencil_size]) { ... }',
        description: 'Nested loop over neighboring cells. Must be used inside a foreach loop. Default stencil size is 1.',
        example: `foreach()
  foreach_neighbor(1)
    total += f[];`,
        seeAlso: ['foreach']
    },
    'foreach_level': {
        signature: 'foreach_level(level) { ... }',
        description: 'Iterates over all cells at a specific refinement level in adaptive (tree) grids.',
        seeAlso: ['foreach', 'adapt_wavelet']
    },
    'foreach_leaf': {
        signature: 'foreach_leaf() { ... }',
        description: 'Iterates over all leaf cells (finest level) in adaptive (tree) grids.',
        seeAlso: ['foreach', 'foreach_level']
    },
    'foreach_cell': {
        signature: 'foreach_cell() { ... }',
        description: 'Iterates over all cells including non-leaf cells in adaptive grids.',
        seeAlso: ['foreach', 'foreach_leaf']
    },
    'foreach_child': {
        signature: 'foreach_child() { ... }',
        description: 'Iterates over child cells of the current cell in adaptive grids. Must be nested in foreach_cell.',
        seeAlso: ['foreach_cell']
    },
    'event': {
        signature: 'event name (condition) { ... }',
        description: 'Defines an event handler that is triggered when the condition is met. Common conditions include iteration counts (i++), time (t++), and specific values (t = 0).',
        example: `event init (i = 0) {
  // Initialization code
}

event output (t += 0.1) {
  // Output every 0.1 time units
}`,
        seeAlso: ['run', 'i', 't']
    },
    'reduction': {
        signature: 'reduction(op:var)',
        description: 'Specifies a parallel reduction operation within a foreach loop. Operations: +, *, min, max. Essential for MPI parallel computations.',
        example: `double total = 0;
foreach(reduction(+:total))
  total += f[];`,
        seeAlso: ['foreach', 'mpi_all_reduce']
    },
    // Field types
    'scalar': {
        signature: 'scalar name[, name2, ...];',
        description: 'Declares a scalar field. Scalar fields store one value per cell and can be accessed with [] notation.',
        example: `scalar f[], g[];

foreach()
  f[] = sin(x);`,
        seeAlso: ['vector', 'tensor', 'face']
    },
    'vector': {
        signature: 'vector name[, name2, ...];',
        description: 'Declares a vector field with components for each dimension. Components are accessed as name.x, name.y, name.z.',
        example: `vector u[];

foreach() {
  u.x[] = 1.0;
  u.y[] = 0.0;
}`,
        seeAlso: ['scalar', 'face', 'tensor']
    },
    'tensor': {
        signature: 'tensor name[];',
        description: 'Declares a tensor field. Components are accessed as name.x.x, name.x.y, etc.',
        example: `tensor T[];

foreach()
  T.x.y[] = 0.5*(du.x + dv.y);`,
        seeAlso: ['vector', 'symmetric']
    },
    'face': {
        signature: 'face vector name[];',
        description: 'Declares a face-centered vector field. Values are stored at cell faces rather than cell centers.',
        example: `face vector uf[];

foreach_face(x)
  uf.x[] = 1.0;`,
        seeAlso: ['vector', 'foreach_face']
    },
    'vertex': {
        signature: 'vertex scalar name[];',
        description: 'Declares a vertex-centered scalar field. Values are stored at cell corners.',
        example: `vertex scalar psi[];

foreach_vertex()
  psi[] = stream_function(x, y);`,
        seeAlso: ['scalar', 'foreach_vertex']
    },
    'coord': {
        signature: 'coord name;',
        description: 'A structure representing coordinates with x, y, z components. Not a field type.',
        example: `coord center = {0.5, 0.5, 0.5};
coord velocity = {u.x[], u.y[], u.z[]};`,
        seeAlso: ['vector', 'point']
    },
    // Functions
    'run': {
        signature: 'run()',
        description: 'Starts the simulation loop. Events are processed in order of their conditions. Returns when the simulation ends.',
        example: `int main() {
  init_grid(64);
  run();
}`,
        seeAlso: ['event', 'init_grid']
    },
    'init_grid': {
        signature: 'init_grid(int n)',
        description: 'Initializes the computational grid with n cells in each direction. For adaptive grids, this sets the initial resolution.',
        example: `init_grid(128);  // 128x128 grid (2D) or 128x128x128 (3D)`,
        seeAlso: ['run', 'N', 'L0']
    },
    'adapt_wavelet': {
        signature: 'adapt_wavelet({fields}, (double[]){errors}, maxlevel[, minlevel])',
        description: 'Adapts the grid based on wavelet error estimates. Fields are refined where the error exceeds the threshold.',
        example: `adapt_wavelet({f, u}, (double[]){1e-3, 1e-2}, 8, 4);`,
        seeAlso: ['refine', 'unrefine', 'foreach_level']
    },
    'diffusion': {
        signature: 'diffusion(scalar f, double dt, face vector D)',
        description: 'Solves the diffusion equation df/dt = div(D*grad(f)) for one time step.',
        example: `face vector D[];
foreach_face()
  D.x[] = 0.01;
diffusion(f, dt, D);`,
        seeAlso: ['poisson', 'advection']
    },
    'poisson': {
        signature: 'poisson(scalar a, scalar b, face vector alpha, scalar lambda)',
        description: 'Solves the Poisson equation div(alpha*grad(a)) + lambda*a = b.',
        example: `poisson(p, div_u, fm, zerof);`,
        seeAlso: ['diffusion', 'mg_solve']
    },
    'output_ppm': {
        signature: 'output_ppm(scalar f, FILE *fp[, options])',
        description: 'Outputs a scalar field as a PPM image. Options include min, max, linear, box, mask.',
        example: `output_ppm(f, fopen("f.ppm", "w"), linear = true);`,
        seeAlso: ['output_gfs', 'output_vtu', 'dump']
    },
    'dump': {
        signature: 'dump([file = "dump"])',
        description: 'Saves the complete simulation state to a file for checkpointing or post-processing.',
        example: `event snapshots (t += 1.0)
  dump();`,
        seeAlso: ['restore', 'output_gfs']
    },
    'restore': {
        signature: 'restore([file = "dump"])',
        description: 'Restores the simulation state from a dump file.',
        example: `event init (i = 0) {
  if (!restore())
    // Initialize from scratch
}`,
        seeAlso: ['dump']
    },
    'dirichlet': {
        signature: 'f[direction] = dirichlet(value)',
        description: 'Sets a Dirichlet (fixed value) boundary condition.',
        example: `u.t[top] = dirichlet(0);  // No-slip
f[left] = dirichlet(1);  // Fixed value`,
        seeAlso: ['neumann', 'periodic']
    },
    'neumann': {
        signature: 'f[direction] = neumann(value)',
        description: 'Sets a Neumann (fixed gradient) boundary condition.',
        example: `f[right] = neumann(0);  // Zero gradient (outflow)`,
        seeAlso: ['dirichlet', 'periodic']
    },
    'fraction': {
        signature: 'fraction(scalar c, geometry)',
        description: 'Computes the volume fraction of a geometry in each cell. Used for VOF (Volume of Fluid) methods.',
        example: `fraction(f, sq(x) + sq(y) - sq(0.1));  // Circle of radius 0.1`,
        seeAlso: ['vof', 'curvature']
    },
    'interpolate': {
        signature: 'interpolate(scalar f, double x, double y[, double z])',
        description: 'Returns the interpolated value of field f at coordinates (x,y,z).',
        example: `double val = interpolate(f, 0.5, 0.5);`,
        seeAlso: ['foreach']
    },
    'statsf': {
        signature: 'statsf(scalar f)',
        description: 'Returns statistics (min, max, sum, volume) for a scalar field.',
        example: `stats s = statsf(f);
printf("min=%g max=%g\\n", s.min, s.max);`,
        seeAlso: ['normf', 'change']
    },
    'normf': {
        signature: 'normf(scalar f)',
        description: 'Returns the L1, L2, and Linf norms of a scalar field.',
        example: `norm n = normf(f);
printf("L2 norm = %g\\n", n.rms);`,
        seeAlso: ['statsf', 'change']
    },
    // Variables
    'Delta': {
        signature: 'Delta',
        description: 'The cell size at the current position. In adaptive grids, this varies with refinement level.',
        example: `foreach()
  volume += sq(Delta);  // 2D cell area`,
        seeAlso: ['level', 'x', 'y', 'z']
    },
    'level': {
        signature: 'level',
        description: 'The refinement level of the current cell in adaptive grids. Higher levels = finer resolution.',
        example: `foreach()
  if (level < 5)
    refine(true);`,
        seeAlso: ['Delta', 'depth', 'adapt_wavelet']
    },
    't': {
        signature: 't',
        description: 'The current simulation time. Updated automatically by the timestepping loop.',
        example: `event output (t += 0.1; t <= 10)
  printf("t = %g\\n", t);`,
        seeAlso: ['dt', 'i', 'event']
    },
    'dt': {
        signature: 'dt',
        description: 'The current time step size. Can be set manually or computed by CFL conditions.',
        example: `DT = 0.01;  // Maximum time step
event adapt (i++) {
  dt = dtnext(DT);
}`,
        seeAlso: ['t', 'DT']
    },
    'i': {
        signature: 'i',
        description: 'The current iteration count. Updated automatically each timestep.',
        example: `event output (i += 100)
  printf("iteration %d, t = %g\\n", i, t);`,
        seeAlso: ['t', 'event']
    },
    'N': {
        signature: 'N',
        description: 'The number of grid cells in each direction (set by init_grid or command line).',
        example: `init_grid(N);  // N can be passed as -N argument`,
        seeAlso: ['init_grid', 'L0']
    },
    'L0': {
        signature: 'L0',
        description: 'The domain size. Default is 1.0. The domain extends from (X0,Y0,Z0) to (X0+L0, Y0+L0, Z0+L0).',
        example: `L0 = 10.;  // Domain from 0 to 10
X0 = -L0/2;  // Center at origin`,
        seeAlso: ['X0', 'Y0', 'Z0', 'N']
    },
    'pid': {
        signature: 'pid()',
        description: 'Returns the MPI process ID (rank). Returns 0 for non-MPI runs.',
        example: `if (pid() == 0)
  printf("Running on %d processes\\n", npe());`,
        seeAlso: ['npe', 'MPI_Comm_rank']
    },
    'npe': {
        signature: 'npe()',
        description: 'Returns the total number of MPI processes. Returns 1 for non-MPI runs.',
        example: `printf("Process %d of %d\\n", pid(), npe());`,
        seeAlso: ['pid', 'MPI_Comm_size']
    }
};
/**
 * Create completion items for all Basilisk constructs
 */
function createCompletionItems() {
    const items = [];
    // Control keywords with snippets
    items.push({
        label: 'foreach',
        kind: vscode_languageserver_1.CompletionItemKind.Keyword,
        detail: 'Basilisk iteration',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['foreach']?.description || 'Iterate over all cells'
        },
        insertText: 'foreach() {\n\t$0\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'foreach_face',
        kind: vscode_languageserver_1.CompletionItemKind.Keyword,
        detail: 'Face iteration',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['foreach_face']?.description || 'Iterate over faces'
        },
        insertText: 'foreach_face(${1:x}) {\n\t$0\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'foreach_vertex',
        kind: vscode_languageserver_1.CompletionItemKind.Keyword,
        detail: 'Vertex iteration',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['foreach_vertex']?.description || 'Iterate over vertices'
        },
        insertText: 'foreach_vertex() {\n\t$0\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'foreach_boundary',
        kind: vscode_languageserver_1.CompletionItemKind.Keyword,
        detail: 'Boundary iteration',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['foreach_boundary']?.description || 'Iterate over boundary cells'
        },
        insertText: 'foreach_boundary(${1|left,right,top,bottom,front,back|}) {\n\t$0\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'foreach_dimension',
        kind: vscode_languageserver_1.CompletionItemKind.Keyword,
        detail: 'Dimension loop',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['foreach_dimension']?.description || 'Loop over dimensions'
        },
        insertText: 'foreach_dimension() {\n\t$0\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'foreach_neighbor',
        kind: vscode_languageserver_1.CompletionItemKind.Keyword,
        detail: 'Neighbor iteration',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['foreach_neighbor']?.description || 'Iterate over neighbors'
        },
        insertText: 'foreach_neighbor(${1:1}) {\n\t$0\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'foreach_level',
        kind: vscode_languageserver_1.CompletionItemKind.Keyword,
        detail: 'Level iteration',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['foreach_level']?.description || 'Iterate over level'
        },
        insertText: 'foreach_level(${1:level}) {\n\t$0\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'foreach_leaf',
        kind: vscode_languageserver_1.CompletionItemKind.Keyword,
        detail: 'Leaf iteration',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['foreach_leaf']?.description || 'Iterate over leaf cells'
        },
        insertText: 'foreach_leaf() {\n\t$0\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'foreach_cell',
        kind: vscode_languageserver_1.CompletionItemKind.Keyword,
        detail: 'Cell iteration',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['foreach_cell']?.description || 'Iterate over all cells'
        },
        insertText: 'foreach_cell() {\n\t$0\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'foreach_child',
        kind: vscode_languageserver_1.CompletionItemKind.Keyword,
        detail: 'Child iteration',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['foreach_child']?.description || 'Iterate over children'
        },
        insertText: 'foreach_child() {\n\t$0\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    // Event
    items.push({
        label: 'event',
        kind: vscode_languageserver_1.CompletionItemKind.Keyword,
        detail: 'Event handler',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['event']?.description || 'Define an event handler'
        },
        insertText: 'event ${1:name} (${2|i = 0,t = 0,i++,t++,t += 0.1|}) {\n\t$0\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    // Event templates
    items.push({
        label: 'event init',
        kind: vscode_languageserver_1.CompletionItemKind.Snippet,
        detail: 'Initialization event',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: 'Event triggered at the start of the simulation (i = 0)'
        },
        insertText: 'event init (i = 0) {\n\t$0\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'event logfile',
        kind: vscode_languageserver_1.CompletionItemKind.Snippet,
        detail: 'Logging event',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: 'Event for logging output every iteration'
        },
        insertText: 'event logfile (i++) {\n\tfprintf(stderr, "i = %d, t = %g\\\\n", i, t);\n\t$0\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'event adapt',
        kind: vscode_languageserver_1.CompletionItemKind.Snippet,
        detail: 'Adaptation event',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: 'Event for adaptive mesh refinement'
        },
        insertText: 'event adapt (i++) {\n\tadapt_wavelet({${1:f}}, (double[]){${2:1e-3}}, ${3:8});\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'event movies',
        kind: vscode_languageserver_1.CompletionItemKind.Snippet,
        detail: 'Output event',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: 'Event for periodic output/visualization'
        },
        insertText: 'event movies (t += ${1:0.1}; t <= ${2:10}) {\n\toutput_ppm(${3:f}, fopen("${4:field}.ppm", "w"));\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'event end',
        kind: vscode_languageserver_1.CompletionItemKind.Snippet,
        detail: 'End condition',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: 'Event that ends the simulation'
        },
        insertText: 'event end (t = ${1:10}) {\n\t$0\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    // Field types
    items.push({
        label: 'scalar',
        kind: vscode_languageserver_1.CompletionItemKind.TypeParameter,
        detail: 'Scalar field',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['scalar']?.description || 'Scalar field type'
        },
        insertText: 'scalar ${1:f}[];',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'vector',
        kind: vscode_languageserver_1.CompletionItemKind.TypeParameter,
        detail: 'Vector field',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['vector']?.description || 'Vector field type'
        },
        insertText: 'vector ${1:u}[];',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'tensor',
        kind: vscode_languageserver_1.CompletionItemKind.TypeParameter,
        detail: 'Tensor field',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['tensor']?.description || 'Tensor field type'
        },
        insertText: 'tensor ${1:T}[];',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'face vector',
        kind: vscode_languageserver_1.CompletionItemKind.TypeParameter,
        detail: 'Face-centered vector',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['face']?.description || 'Face-centered vector field'
        },
        insertText: 'face vector ${1:uf}[];',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'vertex scalar',
        kind: vscode_languageserver_1.CompletionItemKind.TypeParameter,
        detail: 'Vertex-centered scalar',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['vertex']?.description || 'Vertex-centered scalar field'
        },
        insertText: 'vertex scalar ${1:psi}[];',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'coord',
        kind: vscode_languageserver_1.CompletionItemKind.TypeParameter,
        detail: 'Coordinate struct',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['coord']?.description || 'Coordinate type'
        },
        insertText: 'coord ${1:pos} = {${2:0}, ${3:0}, ${4:0}};',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    // Functions
    for (const func of exports.BUILTIN_FUNCTIONS) {
        const doc = exports.DOCUMENTATION[func];
        items.push({
            label: func,
            kind: vscode_languageserver_1.CompletionItemKind.Function,
            detail: 'Basilisk function',
            documentation: doc ? {
                kind: vscode_languageserver_1.MarkupKind.Markdown,
                value: `${doc.description}${doc.example ? `\n\n**Example:**\n\`\`\`c\n${doc.example}\n\`\`\`` : ''}`
            } : undefined
        });
    }
    // Constants
    for (const constant of exports.CONSTANTS) {
        const doc = exports.DOCUMENTATION[constant];
        items.push({
            label: constant,
            kind: vscode_languageserver_1.CompletionItemKind.Constant,
            detail: 'Basilisk constant',
            documentation: doc ? {
                kind: vscode_languageserver_1.MarkupKind.Markdown,
                value: doc.description
            } : undefined
        });
    }
    // Loop variables
    for (const variable of exports.LOOP_VARIABLES) {
        const doc = exports.DOCUMENTATION[variable];
        items.push({
            label: variable,
            kind: vscode_languageserver_1.CompletionItemKind.Variable,
            detail: 'Loop variable',
            documentation: doc ? {
                kind: vscode_languageserver_1.MarkupKind.Markdown,
                value: doc.description
            } : undefined
        });
    }
    // Include directives
    for (const header of exports.COMMON_HEADERS) {
        items.push({
            label: header,
            kind: vscode_languageserver_1.CompletionItemKind.File,
            detail: 'Basilisk header',
            insertText: `#include "${header}"`,
            insertTextFormat: vscode_languageserver_1.InsertTextFormat.PlainText
        });
    }
    // Main function template
    items.push({
        label: 'main',
        kind: vscode_languageserver_1.CompletionItemKind.Snippet,
        detail: 'Main function template',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: 'Basic Basilisk main function template'
        },
        insertText: 'int main() {\n\tinit_grid(${1:64});\n\trun();\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    // Main with MPI
    items.push({
        label: 'main_mpi',
        kind: vscode_languageserver_1.CompletionItemKind.Snippet,
        detail: 'MPI main function',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: 'Basilisk main function with MPI initialization'
        },
        insertText: 'int main(int argc, char *argv[]) {\n\tMPI_Init(&argc, &argv);\n\tinit_grid(${1:64});\n\trun();\n\tMPI_Finalize();\n\treturn 0;\n}',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    // Boundary condition template
    items.push({
        label: 'boundary_dirichlet',
        kind: vscode_languageserver_1.CompletionItemKind.Snippet,
        detail: 'Dirichlet BC',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: 'Set a Dirichlet (fixed value) boundary condition'
        },
        insertText: '${1:f}[${2|left,right,top,bottom,front,back|}] = dirichlet(${3:0});',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    items.push({
        label: 'boundary_neumann',
        kind: vscode_languageserver_1.CompletionItemKind.Snippet,
        detail: 'Neumann BC',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: 'Set a Neumann (fixed gradient) boundary condition'
        },
        insertText: '${1:f}[${2|left,right,top,bottom,front,back|}] = neumann(${3:0});',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    // Reduction
    items.push({
        label: 'reduction',
        kind: vscode_languageserver_1.CompletionItemKind.Keyword,
        detail: 'Parallel reduction',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['reduction']?.description || 'Parallel reduction operator'
        },
        insertText: 'reduction(${1|+,*,min,max|}:${2:var})',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    // Adapt wavelet template
    items.push({
        label: 'adapt_wavelet',
        kind: vscode_languageserver_1.CompletionItemKind.Function,
        detail: 'Adaptive refinement',
        documentation: {
            kind: vscode_languageserver_1.MarkupKind.Markdown,
            value: exports.DOCUMENTATION['adapt_wavelet']?.description || 'Wavelet-based adaptation'
        },
        insertText: 'adapt_wavelet({${1:f}}, (double[]){${2:1e-3}}, ${3:maxlevel});',
        insertTextFormat: vscode_languageserver_1.InsertTextFormat.Snippet
    });
    return items;
}
/**
 * Get hover documentation for a symbol
 */
function getHoverDocumentation(symbol) {
    const doc = exports.DOCUMENTATION[symbol];
    if (!doc) {
        return undefined;
    }
    let markdown = `**${doc.signature}**\n\n${doc.description}`;
    if (doc.example) {
        markdown += `\n\n**Example:**\n\`\`\`c\n${doc.example}\n\`\`\``;
    }
    if (doc.seeAlso && doc.seeAlso.length > 0) {
        markdown += `\n\n**See also:** ${doc.seeAlso.join(', ')}`;
    }
    return markdown;
}
/**
 * Check if a word is a Basilisk keyword
 */
function isBasiliskKeyword(word) {
    return (exports.CONTROL_KEYWORDS.includes(word) ||
        exports.FIELD_TYPES.includes(word) ||
        exports.GRID_TYPES.includes(word) ||
        exports.BUILTIN_FUNCTIONS.includes(word) ||
        exports.CONSTANTS.includes(word) ||
        exports.LOOP_VARIABLES.includes(word) ||
        exports.MPI_KEYWORDS.includes(word));
}
/**
 * Get the category of a Basilisk keyword
 */
function getKeywordCategory(word) {
    if (exports.CONTROL_KEYWORDS.includes(word)) {
        return 'control';
    }
    if (exports.FIELD_TYPES.includes(word)) {
        return 'type';
    }
    if (exports.GRID_TYPES.includes(word)) {
        return 'type';
    }
    if (exports.BUILTIN_FUNCTIONS.includes(word)) {
        return 'function';
    }
    if (exports.CONSTANTS.includes(word)) {
        return 'constant';
    }
    if (exports.LOOP_VARIABLES.includes(word)) {
        return 'variable';
    }
    if (exports.MPI_KEYWORDS.includes(word)) {
        return 'mpi';
    }
    return undefined;
}
//# sourceMappingURL=basiliskLanguage.js.map