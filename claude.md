# YMCA Chatbot - Development Guidelines

## Project Overview

This is a YMCA historical chatbot application that helps users explore YMCA history through conversational AI. The project consists of a Next.js frontend and an AWS Lambda backend with RAG (Retrieval-Augmented Generation) capabilities.

## Tech Stack

### Frontend
- **Framework**: Next.js 16.0.1 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **React**: 19.2.0

### Backend
- **Runtime**: Node.js on AWS Lambda
- **Infrastructure**: AWS CDK
- **AI/ML**: Amazon Bedrock (Nova models)
- **Database**: Amazon Kendra for RAG
- **Storage**: Amazon S3

## Code Style Guidelines

### Next.js Development Philosophy

Follow these core principles when developing:

#### Core Responsibilities
* Follow user requirements precisely and to the letter
* Think step-by-step: describe your plan in detailed pseudocode first
* Confirm approach, then write complete, working code
* Write correct, best practice, DRY, bug-free, fully functional code
* Prioritize readable code over performance optimization
* Implement all requested functionality completely
* Leave NO todos, placeholders, or missing pieces
* Include all required imports and proper component naming
* Be concise and minimize unnecessary prose

### Frontend

#### Component Structure
- Use functional components with hooks
- Place component files in `frontend/app/` following Next.js App Router conventions
- Export default for page components, named exports for reusable components
- **Use Server Components by default**, Client Components (`"use client"`) only when needed
- Leverage App Router architecture and Next.js 16 features
- Implement proper data fetching patterns

#### TypeScript Best Practices
- Use TypeScript for all new files
- Avoid `any` types - prefer specific types or generics
- Define interfaces for component props
- **Define types when possible** for better type safety
- Use strict typing patterns

#### Code Quality Standards
- **Use early returns** for better readability
- **Use descriptive variable and function names**
- **Prefix event handlers with "handle"** (handleClick, handleSubmit, handleKeyDown)
- **Use const over function declarations**: `const toggle = () => {}`
- Implement proper accessibility features:
  - Use `tabIndex` for keyboard navigation
  - Add `aria-label` attributes for screen readers
  - Handle keyboard events (onKeyDown, onKeyPress)
- Use destructuring for cleaner code
- Keep functions small and focused

#### Styling with Tailwind CSS
- **ALWAYS use Tailwind classes for styling**
- **NEVER use CSS files or inline styles** (except for complex gradients via style prop)
- Follow the Figma design specifications for colors, spacing, and typography
- Use custom color values from designs (e.g., `#0089d0`, `#01a490`)
- Use conditional classes efficiently
- Maintain consistent spacing using Tailwind's spacing scale
- Use arbitrary values for design-specific measurements: `px-[24px]`

#### State Management
- Use React hooks (`useState`, `useEffect`) for local state
- Add `"use client"` directive when using client-side hooks
- Keep state as close to where it's used as possible
- Follow React 19 best practices

#### Navigation
- Use Next.js `Link` component for internal navigation
- Maintain the following route structure:
  - `/` - Welcome screen with topic cards
  - `/chat` - Conversational AI experience
- Follow Next.js 16 caching and optimization strategies

### Backend

#### Lambda Functions
- Each Lambda should have a single responsibility
- Use async/await for asynchronous operations
- Implement proper error handling with try-catch blocks
- Return appropriate HTTP status codes

#### AWS CDK
- Keep infrastructure code in `backend/` directory
- Use TypeScript for CDK stacks
- Follow AWS best practices for resource naming and tagging

## File Organization

```
YMCA_Scono_chatbot/
├── frontend/
│   ├── app/
│   │   ├── page.tsx          # Home/Welcome screen
│   │   ├── layout.tsx         # Root layout
│   │   ├── globals.css        # Global styles
│   │   └── chat/
│   │       └── page.tsx       # Chat interface
│   ├── public/                # Static assets
│   └── package.json
├── backend/
│   ├── lambda/                # Lambda function code
│   ├── cdk/                   # CDK infrastructure
│   └── package.json
├── docs/                      # Documentation
└── claude.md                  # This file
```

## Design System

### Colors
- **Primary Blue**: `#0089d0` - User messages, story badges
- **Teal**: `#01a490` - Action buttons, "Why It Mattered" sections
- **Orange**: `#f47920` - "Lessons & Themes" sections
- **Purple**: `#92278f` - "What this teaches us" sidebars
- **Text Dark**: `#231f20` - Primary text
- **Text Gray**: `#636466` - Secondary text, labels
- **Border**: `#d1d5dc` - Card borders, dividers

### Typography
- Use system fonts as fallbacks for Cachet Std
- Maintain font weights: normal (400), medium (500), bold (700)
- Follow design line heights and letter spacing

### Component Patterns
- Cards have `12px` border radius
- Buttons use `100px` (pill shape) or `12px` radius
- Consistent padding: `16px` or `24px`
- Hover effects with `transition-colors`

## Asset Management

### Images from Figma
- Images currently load from Figma localhost server (`http://localhost:3845/assets/...`)
- For production, export assets from Figma and place in `frontend/public/`
- Update image paths to use Next.js public directory (e.g., `/logo.png`)
- Use Next.js `Image` component for optimized loading (optional)

### Required Assets
1. YMCA logo (PNG)
2. Language/globe icon (SVG)
3. Dropdown chevron icon (SVG)
4. Topic card icons (4 SVGs with different themes)
5. Section icons (Story, Why It Mattered, Lessons, etc.)
6. Action icons (Send arrow, sources, etc.)

## Development Workflow

### Starting the Development Server

```bash
# Frontend
cd frontend
npm install
npm run dev
# Access at http://localhost:3000

# Backend (if running locally)
cd backend
npm install
# Follow AWS CDK deployment instructions
```

### Making Changes

1. **UI Changes**: Refer to Figma designs for exact specifications
2. **New Pages**: Create new directories in `frontend/app/`
3. **Styling**: Use Tailwind classes matching the design system
4. **State**: Keep interactive features client-side with `"use client"`

### Testing

- Test all navigation flows (Home ↔ Chat)
- Verify hover states on interactive elements
- Check responsive behavior at different screen sizes
- Ensure images load correctly (Figma server must be running)

## Best Practices

### AI Development Assistant Guidelines

When working on this project with AI assistance, follow these protocols:

#### Response Protocol
1. If uncertain about correctness, state so explicitly
2. If you don't know something, admit it rather than guessing
3. Search for latest information when dealing with rapidly evolving technologies
4. Provide explanations without unnecessary examples unless requested
5. Stay on-point and avoid verbose explanations

#### Implementation Approach
- Think step-by-step before coding
- Confirm architectural approach before implementation
- Write complete, working code without placeholders
- Implement all requested functionality in full
- Include all necessary imports and dependencies

#### Knowledge Updates
When working with Next.js 16, React 19, or other rapidly evolving technologies, search for the latest documentation and best practices to ensure accuracy and current implementation patterns.

### Code Quality
- Write clean, readable code with meaningful variable names
- Add comments for complex logic, not obvious code
- Keep functions small and focused
- Use destructuring for cleaner code
- Follow DRY (Don't Repeat Yourself) principles
- Write bug-free, fully functional code

### Performance
- Minimize client-side JavaScript
- Use server components where possible (Next.js App Router default)
- Only add `"use client"` when necessary (hooks, event handlers)
- Follow Next.js optimization strategies
- Implement proper caching patterns

### Accessibility
- Use semantic HTML elements
- Include alt text for images
- Maintain proper heading hierarchy
- Ensure sufficient color contrast
- Implement keyboard navigation (tabIndex)
- Add ARIA labels for screen readers
- Handle keyboard events properly

### Git Workflow
- Write clear, descriptive commit messages
- Keep commits focused on single changes
- Follow the existing commit message style in the repository

## Common Tasks

### Adding a New Page
1. Create directory in `frontend/app/[page-name]/`
2. Add `page.tsx` with default export
3. Add navigation links from existing pages
4. Follow existing component structure and styling

### Adding Interactive Features
1. Add `"use client"` directive at top of file
2. Import React hooks (`useState`, `useEffect`, etc.)
3. Implement state management
4. Add event handlers
5. Apply hover/focus states with Tailwind

### Updating Styles
1. Reference Figma design for exact values
2. Use Tailwind utility classes
3. Use arbitrary values for design-specific measurements: `px-[24px]`
4. Maintain consistency with existing components

## Notes

- The project uses Tailwind CSS v4 with CSS-based configuration (no `tailwind.config.js`)
- Images currently require Figma desktop app running to display
- The chatbot uses Amazon Bedrock with Nova models for AI responses
- RAG is implemented using Amazon Kendra for document retrieval

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com)
- [React Documentation](https://react.dev)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- Project Documentation: `docs/` directory
