export const COMMON_SKILLS = [
    // Design & UX
    "UI Design",
    "UX Design",
    "Wireframing",
    "Prototyping",
    "Heuristic Evaluation",
    "Usability Testing",
    "User Research",
    "Design QA",
    "Figma",
    "Adobe XD",
    "Sketch",
    "Persona Development",
    "Adobe Photoshop",
    "Adobe Illustrator",
    "InDesign",
    "Canva",
    
    // Development & Tech
    "HTML",
    "CSS",
    "JavaScript",
    "React",
    "Next.js",
    "TypeScript",
    "Node.js",
    "Python",
    "Java",
    "C++",
    "C#",
    "PHP",
    "Ruby",
    "Go",
    "Rust",
    "Swift",
    "Kotlin",
    "SQL",
    "MongoDB",
    "PostgreSQL",
    "MySQL",
    "Redis",
    "Git",
    "Docker",
    "Kubernetes",
    "AWS",
    "Azure",
    "Google Cloud",
    "Jenkins",
    "CI/CD",
    "DevOps",
    "Linux",
    "Bash",
    "API Development",
    "REST APIs",
    "GraphQL",
    "Microservices",
    "Kendo UI",
    "UI Automation",
    "SoapUI",
    "Semantic UI",
    
    // Data Science & Analytics
    "Data Analysis",
    "Machine Learning",
    "Deep Learning",
    "Data Visualization",
    "Statistical Analysis",
    "R",
    "Pandas",
    "NumPy",
    "Scikit-learn",
    "TensorFlow",
    "PyTorch",
    "Jupyter",
    "Tableau",
    "Power BI",
    "Excel",
    "Google Analytics",
    "A/B Testing",
    "Data Mining",
    "Big Data",
    "Hadoop",
    "Spark",
    "ETL",
    
    // Marketing & Sales
    "Digital Marketing",
    "Content Marketing",
    "Social Media Marketing",
    "SEO",
    "SEM",
    "PPC",
    "Email Marketing",
    "Marketing Automation",
    "CRM",
    "Salesforce",
    "HubSpot",
    "Lead Generation",
    "Customer Acquisition",
    "Brand Management",
    "Market Research",
    "Copywriting",
    "Content Creation",
    "Video Marketing",
    "Influencer Marketing",
    "Conversion Optimization",
    "Sales Strategy",
    "B2B Sales",
    "B2C Sales",
    "Account Management",
    "Customer Success",
    "Cold Calling",
    "Negotiation",
    
    // Finance & Accounting
    "Financial Analysis",
    "Financial Modeling",
    "Budgeting",
    "Forecasting",
    "Accounting",
    "Bookkeeping",
    "Tax Preparation",
    "Auditing",
    "Risk Management",
    "Investment Analysis",
    "Portfolio Management",
    "QuickBooks",
    "SAP",
    "Oracle Financials",
    "Excel Modeling",
    "Financial Reporting",
    "Cost Analysis",
    "Cash Flow Management",
    "Compliance",
    "GAAP",
    "IFRS",
    
    // Human Resources
    "Recruitment",
    "Talent Acquisition",
    "Employee Relations",
    "Performance Management",
    "Training & Development",
    "Compensation & Benefits",
    "HR Analytics",
    "Organizational Development",
    "Change Management",
    "Diversity & Inclusion",
    "Employee Engagement",
    "HRIS",
    "Workday",
    "ATS",
    "Onboarding",
    "Conflict Resolution",
    
    // Operations & Supply Chain
    "Operations Management",
    "Supply Chain Management",
    "Logistics",
    "Inventory Management",
    "Process Improvement",
    "Lean Manufacturing",
    "Six Sigma",
    "Quality Assurance",
    "Vendor Management",
    "Procurement",
    "Production Planning",
    "Warehouse Management",
    "Distribution",
    "ERP",
    "Continuous Improvement",
    "Cost Reduction",
    
    // Customer Service & Support
    "Customer Service",
    "Technical Support",
    "Help Desk",
    "Troubleshooting",
    "Customer Retention",
    "Complaint Resolution",
    "Live Chat Support",
    "Phone Support",
    "Email Support",
    "Zendesk",
    "Freshdesk",
    "ServiceNow",
    "ITIL",
    
    // Legal & Compliance
    "Legal Research",
    "Contract Management",
    "Compliance Management",
    "Risk Assessment",
    "Regulatory Affairs",
    "Intellectual Property",
    "Corporate Law",
    "Employment Law",
    "Data Privacy",
    "GDPR",
    "Legal Writing",
    "Litigation Support",
    
    // Healthcare & Medical
    "Clinical Research",
    "Medical Coding",
    "Healthcare Administration",
    "Patient Care",
    "Medical Writing",
    "Regulatory Compliance",
    "Electronic Health Records",
    "HIPAA",
    "Medical Device",
    "Pharmaceutical",
    "Nursing",
    "Telemedicine",
    
    // Education & Training
    "Curriculum Development",
    "Instructional Design",
    "E-Learning",
    "Training Delivery",
    "Educational Technology",
    "Learning Management Systems",
    "Assessment Design",
    "Adult Learning",
    "Classroom Management",
    "Online Teaching",
    
    // General Business & Soft Skills
    "Project Management",
    "Agile",
    "Scrum",
    "Communication",
    "Leadership",
    "Problem Solving",
    "Team Collaboration",
    "Strategic Planning",
    "Business Analysis",
    "Requirements Gathering",
    "Stakeholder Management",
    "Time Management",
    "Critical Thinking",
    "Decision Making",
    "Presentation Skills",
    "Public Speaking",
    "Mentoring",
    "Cross-functional Collaboration",
    "Client Relations",
    "Multitasking",
    "Adaptability",
    "Innovation",
    "Creative Thinking",
    "Analytical Thinking",
    "Attention to Detail",
];

export const RELATED_SKILLS: { [key: string]: string[] } = {
    // Development & Tech
    "HTML": ["CSS", "Responsive Design", "SEO", "JavaScript"],
    "CSS": ["Responsive Design", "Tailwind", "SASS", "HTML"],
    "JavaScript": ["TypeScript", "React", "Node.js", "Next.js", "HTML"],
    "TypeScript": ["React", "Next.js", "Node.js", "JavaScript"],
    "React": ["TypeScript", "Next.js", "Redux", "React Testing Library", "JavaScript"],
    "Next.js": ["React", "TypeScript", "SEO", "Node.js"],
    "Vue.js": ["JavaScript", "Vuex", "Pinia"],
    "Node.js": ["JavaScript", "TypeScript", "Express.js", "MongoDB"],
    "Python": ["Django", "Flask", "Pandas", "NumPy", "Machine Learning", "Data Analysis"],
    "Java": ["Spring", "Maven", "Gradle", "JUnit"],
    "C#": [".NET", "ASP.NET", "Entity Framework"],
    "PHP": ["Laravel", "MySQL", "WordPress"],
    "Laravel": ["PHP", "MySQL", "REST APIs"],
    "Ruby": ["Ruby on Rails", "RSpec"],
    "Go": ["Docker", "Kubernetes", "Microservices"],
    "Swift": ["iOS Development", "Xcode"],
    "Kotlin": ["Android Development", "Java"],
    "Tailwind": ["CSS", "Responsive Design"],
    "SQL": ["MySQL", "PostgreSQL", "Database Design"],
    "MySQL": ["SQL", "Database Design", "PHP"],
    "PostgreSQL": ["SQL", "Database Design"],
    "MongoDB": ["NoSQL", "Node.js", "Express.js"],
    "Redis": ["Caching", "Database Design"],
    "Git": ["GitHub", "CI/CD", "Version Control"],
    "GitHub": ["Git", "CI/CD"],
    "Docker": ["Linux", "Kubernetes", "DevOps"],
    "Kubernetes": ["Docker", "AWS", "Azure", "DevOps"],
    "AWS": ["Docker", "Kubernetes", "Cloud Computing"],
    "Azure": ["Docker", "Kubernetes", "Cloud Computing"],
    "Google Cloud": ["Docker", "Kubernetes", "Cloud Computing"],
    "Linux": ["Bash", "Docker", "DevOps"],
    "DevOps": ["Docker", "Kubernetes", "CI/CD", "Linux"],
    "CI/CD": ["Git", "Jenkins", "DevOps"],
    "Jenkins": ["CI/CD", "DevOps"],
    "REST APIs": ["API Development", "JSON", "HTTP"],
    "GraphQL": ["API Development", "React", "Node.js"],
    "Microservices": ["Docker", "Kubernetes", "API Development"],

    // Design & UX
    "UI Design": ["Prototyping", "Figma", "Design QA", "Adobe XD"],
    "UX Design": ["User Research", "Prototyping", "Usability Testing", "UI Design"],
    "User Research": ["UX Design", "Usability Testing", "A/B Testing"],
    "Prototyping": ["Figma", "InVision", "UI Design", "Adobe XD"],
    "Figma": ["Prototyping", "UI Design", "Design QA"],
    "Adobe XD": ["Prototyping", "UI Design", "Adobe Photoshop"],
    "Sketch": ["Prototyping", "UI Design", "InVision"],
    "Adobe Photoshop": ["Adobe Illustrator", "Graphic Design", "Adobe XD"],
    "Adobe Illustrator": ["Adobe Photoshop", "Graphic Design", "InDesign"],
    "InDesign": ["Adobe Illustrator", "Adobe Photoshop", "Print Design"],
    "Canva": ["Graphic Design", "Content Creation", "Social Media Marketing"],

    // Data Science & Analytics
    "Data Analysis": ["Python", "R", "Excel", "Statistical Analysis", "Data Visualization"],
    "Machine Learning": ["Python", "TensorFlow", "PyTorch", "Scikit-learn", "Data Analysis"],
    "Deep Learning": ["Machine Learning", "TensorFlow", "PyTorch", "Neural Networks"],
    "Data Visualization": ["Tableau", "Power BI", "Python", "R", "Data Analysis"],
    "Statistical Analysis": ["R", "Python", "Data Analysis", "SPSS"],
    "R": ["Statistical Analysis", "Data Analysis", "Data Visualization"],
    "Pandas": ["Python", "Data Analysis", "NumPy"],
    "NumPy": ["Python", "Pandas", "Machine Learning"],
    "Scikit-learn": ["Machine Learning", "Python", "Data Analysis"],
    "TensorFlow": ["Machine Learning", "Deep Learning", "Python"],
    "PyTorch": ["Machine Learning", "Deep Learning", "Python"],
    "Tableau": ["Data Visualization", "Data Analysis", "Business Intelligence"],
    "Power BI": ["Data Visualization", "Data Analysis", "Business Intelligence", "Excel"],
    "Excel": ["Data Analysis", "Financial Modeling", "VBA", "Power BI"],
    "Google Analytics": ["Digital Marketing", "Web Analytics", "SEO"],
    "A/B Testing": ["Data Analysis", "Conversion Optimization", "User Research"],

    // Marketing & Sales
    "Digital Marketing": ["SEO", "SEM", "Social Media Marketing", "Content Marketing"],
    "Content Marketing": ["Copywriting", "SEO", "Social Media Marketing", "Content Creation"],
    "Social Media Marketing": ["Digital Marketing", "Content Creation", "Brand Management"],
    "SEO": ["Digital Marketing", "Google Analytics", "Content Marketing", "SEM"],
    "SEM": ["PPC", "Google Ads", "Digital Marketing", "SEO"],
    "PPC": ["SEM", "Google Ads", "Digital Marketing"],
    "Email Marketing": ["Marketing Automation", "CRM", "Digital Marketing"],
    "Marketing Automation": ["Email Marketing", "CRM", "Lead Generation"],
    "CRM": ["Salesforce", "HubSpot", "Customer Success", "Sales Strategy"],
    "Salesforce": ["CRM", "Sales Strategy", "Customer Success"],
    "HubSpot": ["CRM", "Marketing Automation", "Lead Generation"],
    "Lead Generation": ["Sales Strategy", "Digital Marketing", "CRM"],
    "Customer Acquisition": ["Digital Marketing", "Sales Strategy", "Lead Generation"],
    "Brand Management": ["Marketing Strategy", "Social Media Marketing", "Content Creation"],
    "Market Research": ["Data Analysis", "Survey Design", "Consumer Insights"],
    "Copywriting": ["Content Creation", "Content Marketing", "Marketing"],
    "Content Creation": ["Copywriting", "Social Media Marketing", "Video Marketing"],
    "Video Marketing": ["Content Creation", "Social Media Marketing", "YouTube"],
    "Sales Strategy": ["B2B Sales", "B2C Sales", "CRM", "Lead Generation"],
    "B2B Sales": ["Sales Strategy", "Account Management", "Lead Generation"],
    "B2C Sales": ["Sales Strategy", "Customer Service", "Retail"],
    "Account Management": ["B2B Sales", "Customer Success", "CRM"],
    "Customer Success": ["CRM", "Account Management", "Customer Service"],
    "Negotiation": ["Sales Strategy", "Contract Management", "Communication"],

    // Finance & Accounting
    "Financial Analysis": ["Financial Modeling", "Excel", "Budgeting", "Forecasting"],
    "Financial Modeling": ["Excel", "Financial Analysis", "Valuation"],
    "Budgeting": ["Financial Analysis", "Forecasting", "Cost Analysis"],
    "Forecasting": ["Financial Analysis", "Budgeting", "Statistical Analysis"],
    "Accounting": ["Bookkeeping", "Financial Reporting", "GAAP", "QuickBooks"],
    "Bookkeeping": ["Accounting", "QuickBooks", "Financial Reporting"],
    "Tax Preparation": ["Accounting", "Tax Law", "Compliance"],
    "Auditing": ["Accounting", "Risk Management", "Compliance"],
    "Risk Management": ["Financial Analysis", "Compliance", "Insurance"],
    "Investment Analysis": ["Financial Analysis", "Portfolio Management", "Valuation"],
    "Portfolio Management": ["Investment Analysis", "Risk Management", "Financial Analysis"],
    "QuickBooks": ["Accounting", "Bookkeeping", "Small Business"],
    "SAP": ["ERP", "Financial Reporting", "Enterprise Software"],
    "Oracle Financials": ["ERP", "Financial Reporting", "Database Management"],
    "Excel Modeling": ["Excel", "Financial Modeling", "Data Analysis"],
    "Financial Reporting": ["Accounting", "GAAP", "IFRS"],
    "GAAP": ["Accounting", "Financial Reporting", "Auditing"],
    "IFRS": ["Accounting", "Financial Reporting", "International Standards"],

    // Human Resources
    "Recruitment": ["Talent Acquisition", "ATS", "Interviewing"],
    "Talent Acquisition": ["Recruitment", "HR Analytics", "Employer Branding"],
    "Employee Relations": ["HR", "Conflict Resolution", "Communication"],
    "Performance Management": ["HR Analytics", "Employee Development", "Goal Setting"],
    "Training & Development": ["Learning Management Systems", "Instructional Design", "E-Learning"],
    "Compensation & Benefits": ["HR Analytics", "Payroll", "Benefits Administration"],
    "HR Analytics": ["Data Analysis", "People Analytics", "HRIS"],
    "Organizational Development": ["Change Management", "Leadership Development", "Culture"],
    "Change Management": ["Organizational Development", "Project Management", "Communication"],
    "Diversity & Inclusion": ["HR", "Cultural Competency", "Bias Training"],
    "Employee Engagement": ["HR Analytics", "Survey Design", "Culture"],
    "HRIS": ["HR Analytics", "Database Management", "Workday"],
    "Workday": ["HRIS", "HR Analytics", "Cloud Software"],
    "ATS": ["Recruitment", "Talent Acquisition", "HR Technology"],

    // Operations & Supply Chain
    "Operations Management": ["Process Improvement", "Supply Chain Management", "Project Management"],
    "Supply Chain Management": ["Logistics", "Procurement", "Inventory Management"],
    "Logistics": ["Supply Chain Management", "Transportation", "Warehouse Management"],
    "Inventory Management": ["Supply Chain Management", "ERP", "Forecasting"],
    "Process Improvement": ["Lean Manufacturing", "Six Sigma", "Continuous Improvement"],
    "Lean Manufacturing": ["Six Sigma", "Process Improvement", "Quality Management"],
    "Six Sigma": ["Lean Manufacturing", "Process Improvement", "Quality Management"],
    "Quality Assurance": ["Quality Control", "Process Improvement", "Testing"],
    "Vendor Management": ["Procurement", "Contract Management", "Supplier Relations"],
    "Procurement": ["Vendor Management", "Supply Chain Management", "Contract Management"],
    "ERP": ["SAP", "Oracle", "Business Process Management"],
    "Continuous Improvement": ["Process Improvement", "Lean Manufacturing", "Kaizen"],

    // Customer Service & Support
    "Customer Service": ["Customer Success", "Communication", "Problem Solving"],
    "Technical Support": ["Troubleshooting", "Help Desk", "ITIL"],
    "Help Desk": ["Technical Support", "ITIL", "ServiceNow"],
    "Troubleshooting": ["Technical Support", "Problem Solving", "Analytical Thinking"],
    "Customer Retention": ["Customer Success", "Account Management", "CRM"],
    "Zendesk": ["Customer Service", "Help Desk", "Ticketing Systems"],
    "Freshdesk": ["Customer Service", "Help Desk", "CRM"],
    "ServiceNow": ["ITIL", "Help Desk", "IT Service Management"],
    "ITIL": ["IT Service Management", "Process Management", "ServiceNow"],

    // Legal & Compliance
    "Legal Research": ["Legal Writing", "Case Analysis", "Legal Databases"],
    "Contract Management": ["Legal Writing", "Negotiation", "Compliance"],
    "Compliance Management": ["Risk Management", "Regulatory Affairs", "Auditing"],
    "Risk Assessment": ["Risk Management", "Compliance", "Auditing"],
    "Regulatory Affairs": ["Compliance Management", "Legal Research", "Government Relations"],
    "Intellectual Property": ["Patent Law", "Trademark Law", "Legal Research"],
    "Corporate Law": ["Contract Management", "Mergers & Acquisitions", "Securities Law"],
    "Employment Law": ["HR", "Legal Research", "Compliance"],
    "Data Privacy": ["GDPR", "Compliance", "Information Security"],
    "GDPR": ["Data Privacy", "Compliance", "Legal Research"],
    "Legal Writing": ["Legal Research", "Communication", "Document Drafting"],

    // General Business & Soft Skills
    "Project Management": ["Agile", "Scrum", "Stakeholder Management", "Planning"],
    "Agile": ["Scrum", "Project Management", "Software Development"],
    "Scrum": ["Agile", "Project Management", "Sprint Planning"],
    "Communication": ["Leadership", "Team Collaboration", "Presentation Skills"],
    "Leadership": ["Communication", "Team Collaboration", "Management"],
    "Problem Solving": ["Analytical Thinking", "Critical Thinking", "Decision Making"],
    "Team Collaboration": ["Communication", "Leadership", "Cross-functional Collaboration"],
    "Strategic Planning": ["Business Analysis", "Leadership", "Decision Making"],
    "Business Analysis": ["Requirements Gathering", "Process Improvement", "Data Analysis"],
    "Requirements Gathering": ["Business Analysis", "Stakeholder Management", "Documentation"],
    "Stakeholder Management": ["Communication", "Project Management", "Relationship Building"],
    "Time Management": ["Organization", "Prioritization", "Productivity"],
    "Critical Thinking": ["Problem Solving", "Analytical Thinking", "Decision Making"],
    "Decision Making": ["Critical Thinking", "Leadership", "Strategic Planning"],
    "Presentation Skills": ["Public Speaking", "Communication", "PowerPoint"],
    "Public Speaking": ["Presentation Skills", "Communication", "Confidence"],
    "Mentoring": ["Leadership", "Training & Development", "Communication"],
    "Cross-functional Collaboration": ["Team Collaboration", "Communication", "Project Management"],
    "Client Relations": ["Customer Service", "Account Management", "Communication"],
    "Adaptability": ["Change Management", "Flexibility", "Learning Agility"],
    "Innovation": ["Creative Thinking", "Problem Solving", "Design Thinking"],
    "Creative Thinking": ["Innovation", "Problem Solving", "Design Thinking"],
    "Analytical Thinking": ["Problem Solving", "Data Analysis", "Critical Thinking"],
    "Attention to Detail": ["Quality Assurance", "Accuracy", "Thoroughness"],
};

const normalizeSkillKey = (value: string) =>
    value.toLowerCase().replace(/\./g, "").trim();

export type SkillConfig = {
    common: string[];
    related: { [key: string]: string[] };
};

export const HARD_CODED_CONFIG: SkillConfig = {
    common: COMMON_SKILLS,
    related: RELATED_SKILLS,
};

export const computeSuggestedSkills = (
    skills: string[],
    config: SkillConfig = HARD_CODED_CONFIG,
): string[] => {
    const suggestionCounts: { [key: string]: number } = {};
    const existingKeys = new Set(skills.map((skill) => normalizeSkillKey(skill)));

    skills.forEach((baseSkill) => {
        const related = config.related[baseSkill];
        if (!related) return;

        related.forEach((relatedSkill) => {
            const relatedKey = normalizeSkillKey(relatedSkill);
            if (existingKeys.has(relatedKey)) return;
            suggestionCounts[relatedSkill] = (suggestionCounts[relatedSkill] || 0) + 1;
        });
    });

    const rankedSuggestions = Object.entries(suggestionCounts)
        .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return a[0].localeCompare(b[0]);
        })
        .map(([skill]) => skill);

    if (rankedSuggestions.length > 0) {
        return rankedSuggestions.slice(0, 8);
    }

    const sourceCommon = config.common && config.common.length > 0
        ? config.common
        : COMMON_SKILLS;

    return sourceCommon.filter((skill) => {
        const key = normalizeSkillKey(skill);
        return !existingKeys.has(key);
    }).slice(0, 8);
};

export const getSuggestedSkillsForCandidate = (skills: string[]): string[] =>
    computeSuggestedSkills(skills, HARD_CODED_CONFIG);

let cachedConfig: SkillConfig | null = null;

export const loadSkillConfig = async (): Promise<SkillConfig> => {
    if (cachedConfig) {
        return cachedConfig;
    }

    try {
        const response = await fetch("/api/skills/config");

        if (!response.ok) {
            throw new Error(`Failed to load skills config: ${response.status}`);
        }

        const data: any = await response.json();

        const commonFromApi: string[] = Array.isArray(data.common)
            ? data.common.map((s: any) => (s ?? "").toString()).filter(Boolean)
            : [];

        const relatedFromApi: { [key: string]: string[] } =
            data && typeof data.related === "object" && data.related !== null
                ? Object.fromEntries(
                    Object.entries(data.related).map(([key, value]) => [
                        key,
                        Array.isArray(value)
                            ? (value as any[]).map((s) => (s ?? "").toString()).filter(Boolean)
                            : [],
                    ]),
                )
                : {};

        const common = commonFromApi.length > 0 ? commonFromApi : COMMON_SKILLS;
        const related = Object.keys(relatedFromApi).length > 0 ? relatedFromApi : RELATED_SKILLS;

        cachedConfig = { common, related };
        return cachedConfig;
    } catch (error) {
        console.error("Error loading skills config, falling back to hardcoded:", error);
        cachedConfig = HARD_CODED_CONFIG;
        return cachedConfig;
    }
};
