/**
 * HTML fixture samples for testing text extraction
 */

/**
 * Sample 1: Well-structured article with Open Graph tags
 */
export const articleWithOgTags = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta property="og:title" content="Breaking: Major Tech Company Announces New AI Product" />
  <meta property="og:description" content="The company unveiled its latest innovation today." />
  <meta name="twitter:title" content="Tech Company AI Announcement" />
  <title>Breaking News - Tech Site</title>
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/news">News</a>
    </nav>
  </header>
  
  <main>
    <article>
      <h1>Breaking: Major Tech Company Announces New AI Product</h1>
      <div class="article-meta">
        <span>By John Doe</span>
        <span>December 12, 2025</span>
      </div>
      <div class="article-content">
        <p>In a surprising announcement today, a major technology company unveiled its latest artificial intelligence product that promises to revolutionize the industry.</p>
        
        <p>The new product, which has been in development for over two years, combines advanced machine learning algorithms with user-friendly interfaces to make AI accessible to everyone.</p>
        
        <p>"This is a game-changer for the industry," said Jane Smith, CEO of the company. "We believe this technology will empower businesses and individuals alike to solve problems more efficiently."</p>
        
        <p>Industry analysts have responded positively to the announcement, with many predicting significant market impact in the coming months.</p>
        
        <p>The product is expected to launch in early 2026, with beta testing beginning next month for select users.</p>
      </div>
    </article>
    
    <aside class="sidebar">
      <h2>Related Stories</h2>
      <ul>
        <li>Previous AI Announcements</li>
        <li>Industry Trends</li>
      </ul>
    </aside>
  </main>
  
  <footer>
    <p>&copy; 2025 Tech News Site</p>
    <nav>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </nav>
  </footer>
  
  <script>
    console.log('Analytics loaded');
  </script>
</body>
</html>`;

/**
 * Sample 2: Simple blog post with only title tag
 */
export const simpleBlogPost = `<!DOCTYPE html>
<html>
<head>
  <title>How to Build Better Software: 5 Essential Tips</title>
</head>
<body>
  <div class="container">
    <h1>How to Build Better Software: 5 Essential Tips</h1>
    
    <div class="post-content">
      <p>Building quality software is both an art and a science. Here are five essential tips that every developer should know.</p>
      
      <h2>1. Write Clean Code</h2>
      <p>Clean code is easier to read, maintain, and debug. Use meaningful variable names, keep functions small, and follow consistent formatting.</p>
      
      <h2>2. Test Early and Often</h2>
      <p>Don't wait until the end to test your code. Write tests as you develop to catch bugs early and ensure your code works as expected.</p>
      
      <h2>3. Document Your Work</h2>
      <p>Good documentation helps others understand your code and makes it easier to maintain in the future. Write clear comments and maintain up-to-date README files.</p>
      
      <h2>4. Embrace Code Reviews</h2>
      <p>Code reviews help catch bugs, improve code quality, and share knowledge among team members. Always review others' code and accept feedback on your own.</p>
      
      <h2>5. Keep Learning</h2>
      <p>Technology evolves rapidly. Stay current by reading blogs, taking courses, and experimenting with new tools and techniques.</p>
      
      <p>By following these tips, you'll be well on your way to becoming a better software developer.</p>
    </div>
  </div>
</body>
</html>`;

/**
 * Sample 3: News article with Twitter tags only
 */
export const articleWithTwitterTags = `<!DOCTYPE html>
<html>
<head>
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Climate Summit Reaches Historic Agreement" />
  <meta name="twitter:description" content="World leaders agree on ambitious climate targets" />
  <title>Climate Summit 2025 - Global News</title>
</head>
<body>
  <header class="site-header">
    <h1 class="site-title">Global News Network</h1>
  </header>
  
  <div role="main">
    <h1>Climate Summit Reaches Historic Agreement</h1>
    
    <p class="lead">World leaders from over 150 countries have reached a historic agreement on climate action at this year's summit.</p>
    
    <p>The agreement, finalized after two weeks of intense negotiations, commits participating nations to ambitious emissions reduction targets and increased investment in renewable energy.</p>
    
    <p>Environmental groups have praised the agreement as a significant step forward, though some activists argue that more aggressive action is needed.</p>
    
    <p>"This agreement represents real progress," said Dr. Maria Garcia, lead climate scientist. "However, implementation will be key. We need to see concrete actions, not just promises."</p>
    
    <p>The next summit is scheduled for 2027, where progress on these commitments will be reviewed.</p>
  </div>
  
  <div class="advertisement">
    <p>Advertisement: Buy our products!</p>
  </div>
</body>
</html>`;

/**
 * Sample 4: Article with repeated navigation elements (tests deduplication)
 */
export const articleWithRepeatedElements = `<!DOCTYPE html>
<html>
<head>
  <title>Understanding Modern Web Development</title>
</head>
<body>
  <nav class="top-nav">
    <a href="/">Home</a>
    <a href="/about">About</a>
    <a href="/contact">Contact</a>
  </nav>
  
  <article>
    <h1>Understanding Modern Web Development</h1>
    
    <div class="story-body">
      <p>Modern web development has evolved significantly over the past decade. New frameworks, tools, and best practices emerge constantly.</p>
      
      <p>Developers today must be proficient in multiple technologies, from frontend frameworks like React and Vue to backend systems and databases.</p>
      
      <p>The key to success is continuous learning and adaptation to new technologies while maintaining a solid foundation in core principles.</p>
    </div>
  </article>
  
  <nav class="bottom-nav">
    <a href="/">Home</a>
    <a href="/about">About</a>
    <a href="/contact">Contact</a>
  </nav>
  
  <nav class="footer-nav">
    <a href="/">Home</a>
    <a href="/about">About</a>
    <a href="/contact">Contact</a>
  </nav>
</body>
</html>`;

/**
 * Sample 5: Minimal article (tests edge case)
 */
export const minimalArticle = `<!DOCTYPE html>
<html>
<head>
  <title>Short Update</title>
</head>
<body>
  <h1>Short Update</h1>
  <p>This is a very short article with minimal content. It should potentially fail the minimum length validation.</p>
</body>
</html>`;

/**
 * Sample 6: Article with complex structure and multiple content areas
 */
export const complexArticle = `<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="The Future of Space Exploration: What's Next?" />
  <title>Space Exploration Future | Science Daily</title>
</head>
<body>
  <header>
    <div class="logo">Science Daily</div>
    <nav>
      <ul>
        <li><a href="/space">Space</a></li>
        <li><a href="/tech">Technology</a></li>
        <li><a href="/health">Health</a></li>
      </ul>
    </nav>
  </header>
  
  <main>
    <article>
      <header>
        <h1>The Future of Space Exploration: What's Next?</h1>
        <time>December 12, 2025</time>
      </header>
      
      <section class="entry-content">
        <p>As we look toward the future of space exploration, several ambitious missions are on the horizon that could reshape our understanding of the universe.</p>
        
        <h2>Mars Colonization</h2>
        <p>Plans for establishing a permanent human presence on Mars are advancing rapidly. Multiple space agencies and private companies are developing technologies for sustainable habitation on the Red Planet.</p>
        
        <p>The challenges are immense, from developing reliable life support systems to protecting astronauts from radiation. However, recent breakthroughs in propulsion technology and resource utilization bring these goals closer to reality.</p>
        
        <h2>Lunar Gateway</h2>
        <p>The Lunar Gateway, a planned space station orbiting the Moon, will serve as a staging point for missions to the lunar surface and beyond. Construction is expected to begin within the next few years.</p>
        
        <p>This international collaboration brings together expertise from multiple nations, demonstrating the global commitment to space exploration.</p>
        
        <h2>Deep Space Missions</h2>
        <p>Robotic missions to explore the outer planets and their moons continue to reveal fascinating discoveries. Upcoming missions will search for signs of life on Europa and Enceladus, moons known to have subsurface oceans.</p>
        
        <p>These missions represent humanity's quest to answer one of the most profound questions: Are we alone in the universe?</p>
        
        <h2>Conclusion</h2>
        <p>The next decade promises to be transformative for space exploration. With continued investment and international cooperation, we are on the cusp of discoveries that could fundamentally change our place in the cosmos.</p>
      </section>
    </article>
    
    <aside class="sidebar">
      <div class="widget social-share">
        <h3>Share This Article</h3>
        <button>Facebook</button>
        <button>Twitter</button>
        <button>LinkedIn</button>
      </div>
      
      <div class="widget related">
        <h3>Related Articles</h3>
        <ul>
          <li>Recent Mars Discoveries</li>
          <li>Space Technology Advances</li>
        </ul>
      </div>
    </aside>
  </main>
  
  <footer>
    <div class="footer-content">
      <p>&copy; 2025 Science Daily. All rights reserved.</p>
      <nav>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
        <a href="/contact">Contact Us</a>
      </nav>
    </div>
  </footer>
  
  <script src="/analytics.js"></script>
  <script>
    // Initialize analytics
    window.analytics.init();
  </script>
</body>
</html>`;

/**
 * Expected extraction results for testing
 */
export const expectedResults = {
  articleWithOgTags: {
    title: 'Breaking: Major Tech Company Announces New AI Product',
    textIncludes: [
      'surprising announcement today',
      'artificial intelligence product',
      'game-changer for the industry',
      'launch in early 2026',
    ],
    textExcludes: ['Home', 'News', 'Privacy', 'Terms', 'console.log'],
  },
  
  simpleBlogPost: {
    title: 'How to Build Better Software: 5 Essential Tips',
    textIncludes: [
      'Building quality software',
      'Write Clean Code',
      'Test Early and Often',
      'Keep Learning',
    ],
    textExcludes: [],
  },
  
  articleWithTwitterTags: {
    title: 'Climate Summit Reaches Historic Agreement',
    textIncludes: [
      'World leaders',
      'historic agreement',
      'climate action',
      'emissions reduction',
    ],
    textExcludes: ['Advertisement', 'Buy our products'],
  },
  
  articleWithRepeatedElements: {
    title: 'Understanding Modern Web Development',
    textIncludes: [
      'Modern web development',
      'evolved significantly',
      'continuous learning',
    ],
    textExcludes: [],
  },
  
  minimalArticle: {
    title: 'Short Update',
    shouldFailMinLength: true,
  },
  
  complexArticle: {
    title: 'The Future of Space Exploration: What\'s Next?',
    textIncludes: [
      'space exploration',
      'Mars Colonization',
      'Lunar Gateway',
      'Deep Space Missions',
      'Are we alone in the universe',
    ],
    textExcludes: ['Facebook', 'Twitter', 'LinkedIn', 'analytics.js'],
  },
};

