module.exports = function(grunt) {
    grunt.initConfig({
      replace: {
        gtag: {
          src: ['docs/index.html', 'docs/404.html'],
          overwrite: true,
          replacements: [{
            from: /<\/body>/,
            to: `
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-YCTBQN00K5"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-YCTBQN00K5');
    </script>
  </body>`
          }]
        }
      }
    });
  
    grunt.loadNpmTasks('grunt-text-replace');
    grunt.registerTask('default', ['replace:gtag']);
  };
  