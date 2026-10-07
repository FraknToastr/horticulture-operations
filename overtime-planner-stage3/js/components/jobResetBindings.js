(function() {
  var registry = window.HortOpsJobRegistry; if (!registry || !registry.render) return;
  registry.openReset = function(jobId) { if (window.HortOpsJobResetModal) window.HortOpsJobResetModal.open(jobId); };
  var original = registry.render;
  registry.render = function(state) {
    var html = original.call(this, state);
    html = html.replace(/(<button class="btn btn-danger" style="padding: 0\.25rem 0\.4rem;" onclick="event\.stopPropagation\(\); window\.HortOpsJobRegistry\.deleteJob\('([^']+)'\)" title="Delete Job">)/g, '<button class="btn btn-secondary" style="padding:0.25rem 0.45rem;margin-right:4px" onclick="event.stopPropagation();window.HortOpsJobRegistry.openReset(\'$2\')" title="Reset allocations">↻ Reset</button>$1');
    html = html.replace(/(Edit Job Specifications<\/button>)/, '$1<button class="btn btn-secondary" style="width:100%;margin-top:0.5rem" onclick="window.HortOpsJobRegistry.openReset(\'' + (this.selectedJobId || '') + '\')">Reset allocations</button>');
    return html.replace('width: 100px; text-align: right;">Actions</th>', 'width: 150px; text-align: right;">Actions</th>');
  };
}());
