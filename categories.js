// Bookmark categories configuration
// Converted from bookmark_format.yaml

const BOOKMARK_FORMAT = {
  Work_and_Engineering: {
    SRE_and_Operations: {
      Monitoring_and_Observability: [
        'Dynatrace',
        'Prometheus_and_Grafana',
        'Splunk_Dashboards',
        'OpenTelemetry_Documentation'
      ],
      Incident_Management: [
        'Runbooks',
        'Postmortem_Templates',
        'On_Call_Schedules',
        'PagerDuty_Best_Practices'
      ],
      Reliability_Practices: [
        'SLO_SLA_Frameworks',
        'Chaos_Engineering',
        'Google_SRE_Workbook'
      ]
    },
    DevOps_and_Infrastructure: {
      Infrastructure_as_Code: [
        'Terraform_Modules',
        'Ansible_and_Packer',
        'Terragrunt_Examples'
      ],
      CI_CD_Pipelines: [
        'GitHub_Actions',
        'Jenkins_Shared_Libraries',
        'ArgoCD',
        'Spinnaker'
      ],
      Kubernetes_and_Containers: [
        'Helm_Charts',
        'K9s_and_Kubectl_Commands',
        'Docker_Compose_Templates',
        'Cluster_Troubleshooting'
      ],
      Cloud_Platforms: {
        AWS: [
          'EKS_and_Lambda',
          'Cost_Optimization_Tools',
          'IAM_and_Security'
        ],
        GCP: [
          'GKE_and_Cloud_Run',
          'IAM_and_Service_Accounts'
        ],
        Azure: [
          'AKS',
          'DevOps_Pipelines'
        ],
        Multi_Cloud_and_Hybrid: [
          'Vault',
          'Consul',
          'Boundary'
        ]
      }
    },
    Software_Development: {
      Languages: [
        'Python_Tips_and_Snippets',
        'Golang_Concurrency_and_Interfaces',
        'Bash_and_Shell_Utilities',
        'JavaScript_and_TypeScript'
      ],
      Architecture: [
        'Design_Patterns',
        'Microservices_and_APIs',
        'Event_Driven_and_CQRS'
      ],
      Testing_and_Quality: [
        'Unit_and_Integration_Testing',
        'Load_and_Performance_Testing',
        'Contract_Testing'
      ],
      Security: [
        'OWASP_Cheat_Sheets',
        'Secrets_Management',
        'DevSecOps_Tools'
      ]
    }
  },
  Personal_Projects: {
    Homelab: {
      Server_Setup: [
        'Unraid_Configuration',
        'Netplan_Static_IPs',
        'Portainer',
        'Watchtower'
      ],
      Monitoring: [
        'Grafana_Dashboards',
        'Telegraf_and_InfluxDB',
        'Uptime_Kuma',
        'Healthchecks'
      ],
      Networking: [
        'UniFi_Controller',
        'Pi_hole_or_AdGuard',
        'Local_DNS_and_VLANs'
      ]
    },
    Home_Automation: {
      Home_Assistant: [
        'YAML_Automations',
        'Dashboard_Designs_Mushroom_and_TimeFlow',
        'Node_RED',
        'Pyscript',
        'n8n'
      ],
      Devices: [
        'Zigbee2MQTT',
        'Thread_and_Matter',
        'Nanoleaf',
        'Innr',
        'Aqara',
        'Shelly'
      ],
      Projects: [
        'Washing_Machine_Sensor',
        'Doorbell_and_Camera_Integration',
        'Lighting_and_Presence_Automations'
      ]
    },
    DIY_and_Hardware: {
      Electronics: [
        'Raspberry_Pi_Projects',
        'ESPHome_and_ESP32',
        'Arduino_Tutorials'
      ],
      '3D_Printing_and_Design': [
        'Fusion360',
        'FreeCAD',
        'STL_Repositories',
        'Enclosure_and_Mount_Designs'
      ],
      Tools_and_Materials: [
        'Woodworking_Plans',
        'Electrical_Wiring_Guides'
      ]
    }
  },
  Learning_and_Career: {
    Certifications: [
      'AWS_DevOps_Professional',
      'AWS_Solutions_Architect',
      'GCP_Professional_Engineer',
      'Kubernetes_CKA_CKAD'
    ],
    Courses: [
      'LinkedIn_Learning',
      'Pluralsight',
      'Udemy',
      'Coursera'
    ],
    Reading: [
      'Engineering_Blogs_Netflix_Uber_Google',
      'DevOps_and_SRE_Whitepapers',
      'Home_Automation_Forums_and_Subreddits'
    ]
  },
  Utilities_and_References: {
    Documentation: [
      'MDN',
      'DevDocs',
      'Linux_TLDR',
      'RFCs_and_API_References'
    ],
    Cheat_Sheets: [
      'Git',
      'Regex',
      'Docker',
      'Kubernetes'
    ],
    Online_Tools: [
      'JSON_YAML_Formatter',
      'Crontab_Guru',
      'Regex101',
      'Markdown_Previewer'
    ],
    Productivity: [
      'Notion',
      'Obsidian',
      'Miro',
      'Lucidchart',
      'GitHub_Gists'
    ]
  },
  Personal_and_Finance: {
    Property_and_Investments: [
      'West_Lothian_Letting_Agents',
      'Rental_Return_Calculators',
      'Stock_and_ETF_Watchlists'
    ],
    Budgeting: [
      'Money_Dashboard',
      'YNAB',
      'UK_Tax_Allowance_References'
    ],
    Miscellaneous: [
      'Vehicle_Maintenance',
      'Local_Services_Schools_Council_NHS'
    ]
  }
};

/**
 * Formats a key by replacing underscores with spaces
 */
function formatKey(key) {
  return key.replace(/_/g, ' ');
}

/**
 * Recursively extracts all category paths from the bookmark format
 */
function extractCategories(obj, prefix = '') {
  const categories = [];

  for (const key in obj) {
    const formattedKey = formatKey(key);
    const currentPath = prefix ? `${prefix}/${formattedKey}` : formattedKey;

    if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      // This is a category with subcategories
      categories.push(currentPath);
      categories.push(...extractCategories(obj[key], currentPath));
    } else if (Array.isArray(obj[key])) {
      // This is a leaf category with items
      categories.push(currentPath);
    }
  }

  return categories;
}

/**
 * Gets all available categories from the bookmark format
 */
function getAvailableCategories() {
  return extractCategories(BOOKMARK_FORMAT);
}

// Export for use in background.js
if (typeof window !== 'undefined') {
  window.BookmarkCategories = {
    BOOKMARK_FORMAT,
    formatKey,
    extractCategories,
    getAvailableCategories
  };
}
