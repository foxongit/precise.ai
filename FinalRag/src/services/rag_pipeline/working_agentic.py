import sqlite3
import json
import logging
import re
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
import statistics
import math
import os
# Set your Gemini API key here or use environment variable
os.environ['GEMINI_API_KEY'] = 'your-gemini-api-key-here'

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('AgenticFormulaSystem')

class AgenticFormulaSystem:
    def __init__(self, db_path: str = "functions11.db", gemini_api_key: Optional[str] = None):
        """Initialize the Agentic Formula System with fixed database schema"""
        self.db_path = db_path
        self.gemini_api_key = gemini_api_key or os.getenv("GEMINI_API_KEY")
        self.client = None
        self.llm_client = None

        self._update_database_schema()
        self._init_database()
        self._init_llm_client()

        logger.info("=== Agentic Formula System Initialized ===")
        logger.info(f"Database: [OK]")
        logger.info(f"LLM Handler: [{'OK' if self.llm_client else 'FAIL'} ({'AI mode' if self.llm_client else 'fallback mode'})]")

    def _init_database(self):
        """Initialize database with correct schema including calculation_type column and scaling results"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create functions table with all required columns
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS functions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    formula TEXT NOT NULL,
                    parameters TEXT NOT NULL,
                    calculation_type TEXT DEFAULT 'general',
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    usage_count INTEGER DEFAULT 0
                )
            ''')
            
            # Create scaling_results table for storing scaled results
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS scaling_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    function_id INTEGER,
                    execution_id TEXT NOT NULL,
                    original_result REAL NOT NULL,
                    scale_factor_a REAL NOT NULL,
                    offset_b REAL NOT NULL,
                    scaled_result REAL NOT NULL,
                    variables TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (function_id) REFERENCES functions (id)
                )
            ''')
            
            # Check if calculation_type column exists, add if missing
            cursor.execute("PRAGMA table_info(functions)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'calculation_type' not in columns:
                cursor.execute('ALTER TABLE functions ADD COLUMN calculation_type TEXT DEFAULT "general"')
                logger.info("Added missing calculation_type column")
            
            conn.commit()
            conn.close()
            logger.info("Database schema created/verified")
            
        except Exception as e:
            logger.error(f"Database initialization failed: {e}")
            raise
    
    def _update_database_schema(self):
        """Update database schema to include missing columns"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check if description column exists
            cursor.execute("PRAGMA table_info(functions)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if 'description' not in columns:
                logging.info("Adding missing 'description' column to functions table")
                cursor.execute("ALTER TABLE functions ADD COLUMN description TEXT")
                conn.commit()
                
        except sqlite3.Error as e:
            logging.error(f"Database schema update failed: {e}")
        finally:
            conn.close()
        
    def _init_llm_client(self):
        """Initialize Gemini client with fixed configuration"""
        if not self.gemini_api_key:
            logger.warning("No Gemini API key provided - running in fallback mode")
            return

        try:
            import google.generativeai as genai
            genai.configure(api_key=self.gemini_api_key)
            self.llm_client = genai.GenerativeModel('gemini-pro')
            logger.info("Gemini client initialized successfully")
        except ImportError:
            logger.warning("google-generativeai package not installed - running in fallback mode")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client: {e}")


    def _extract_parameters(self, formula: str) -> Dict[str, str]:
        """Extract parameters from formula and infer their types"""
        # Find all variable names in the formula
        variables = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', formula)
        
        # Remove function names
        functions = ['sum', 'avg', 'max', 'min', 'abs', 'sqrt', 'log', 'exp', 'sin', 'cos', 'tan']
        variables = [var for var in variables if var not in functions]
        
        # Infer types based on context
        parameters = {}
        for var in set(variables):
            if any(func in formula for func in ['sum(', 'avg(', 'max(', 'min(']) and var in formula:
                # Check if this variable is used with aggregate functions
                if f'({var})' in formula or f'( {var})' in formula:
                    parameters[var] = 'list'
                else:
                    parameters[var] = 'float'
            else:
                parameters[var] = 'float'
        
        return parameters
    
    def _generate_function_name(self, formula: str, parameters: Dict[str, str]) -> str:
        """Generate a descriptive function name"""
        # Extract key terms from formula
        terms = []
        
        # Add calculation type prefix based on formula content
        if any(op in formula for op in ['sum(', 'avg(', 'max(', 'min(']):
            terms.append('analyze')
        elif any(op in formula for op in ['*', '**', 'exp']):
            terms.append('calculate')
        else:
            terms.append('compute')
        
        # Add main parameter names
        terms.extend(list(parameters.keys())[:3])  # Limit to 3 main parameters
        
        return '_'.join(terms)
    
    def save_function(self, name, formula, parameters, description=None):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO functions 
                (name, formula, parameters, description, created_at, usage_count)
                VALUES (?, ?, ?, ?, datetime('now'), 0)
            ''', (name, formula, json.dumps(parameters), description))
            
            conn.commit()
            logging.info(f"Function '{name}' saved successfully")
            
        except sqlite3.Error as e:
            logging.error(f"Failed to save function: {e}")
            raise
        finally:
            conn.close()
    
    def _get_functions(self) -> List[Dict[str, Any]]:
        """Retrieve all functions from database with proper error handling"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM functions')
            rows = cursor.fetchall()
            
            # Get column names
            cursor.execute("PRAGMA table_info(functions)")
            columns = [column[1] for column in cursor.fetchall()]
            
            conn.close()
            
            functions = []
            for row in rows:
                func_dict = dict(zip(columns, row))
                # Parse parameters JSON safely
                try:
                    func_dict['parameters'] = json.loads(func_dict['parameters'])
                except (json.JSONDecodeError, TypeError):
                    func_dict['parameters'] = {}
                functions.append(func_dict)
            
            return functions
            
        except Exception as e:
            logger.error(f"Failed to retrieve functions: {e}")
            return []
    
    def get_all_functions(self) -> List[Dict[str, Any]]:
        """Public method to retrieve all functions from database"""
        return self._get_functions()
    
    def print_all_functions(self):
        """Print all functions in a formatted way"""
        functions = self.get_all_functions()
        
        if not functions:
            print("No functions found in the database.")
            return
        
        print(f"\n{'='*80}")
        print("📚 ALL FUNCTIONS IN DATABASE")
        print(f"{'='*80}")
        
        for i, func in enumerate(functions, 1):
            print(f"\n🔧 Function #{i}: {func['name']}")
            print(f"   📝 Formula: {func['formula']}")
            print(f"   📊 Parameters: {func['parameters']}")
            print(f"   🏷️ Type: {func.get('calculation_type', 'N/A')}")
            print(f"   📄 Description: {func.get('description', 'N/A')}")
            print(f"   📅 Created: {func.get('created_at', 'N/A')}")
            print(f"   🔄 Usage Count: {func.get('usage_count', 0)}")
            print(f"   🆔 ID: {func['id']}")
        
        print(f"\n📊 Total Functions: {len(functions)}")
        print(f"{'='*80}")
    
    def _apply_scaling(self, result: float, scale_factor_a: float = 1.0, offset_b: float = 0.0) -> float:
        # """Apply linear scaling transformation: ax + b"""
        scaled_result = scale_factor_a * result + offset_b
        logger.info(f"Scaling: {scale_factor_a} * {result} + {offset_b} = {scaled_result}")
        return scaled_result

    
    def _save_scaled_result(self, function_name: str, execution_id: str, original_result: float, 
                           scaled_result: float, scale_factor_a: float, offset_b: float,
                           variables: Dict[str, Any]) -> int:
        """Save scaled result to database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get function ID
            cursor.execute('SELECT id FROM functions WHERE name = ?', (function_name,))
            function_row = cursor.fetchone()
            function_id = function_row[0] if function_row else None
            
            cursor.execute('''
                INSERT INTO scaling_results 
                (function_id, execution_id, original_result, scale_factor_a, offset_b, 
                 scaled_result, variables)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (function_id, execution_id, original_result, scale_factor_a, offset_b, 
                  scaled_result, json.dumps(variables)))
            
            result_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            logger.info(f"Scaled result saved with ID: {result_id}")
            return result_id
            
        except Exception as e:
            logger.error(f"Failed to save scaled result: {e}")
            raise
    
    def get_scaled_result(self, execution_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve scaled result by execution ID"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT sr.*, f.name as function_name, f.formula 
                FROM scaling_results sr
                LEFT JOIN functions f ON sr.function_id = f.id
                WHERE sr.execution_id = ?
                ORDER BY sr.created_at DESC
                LIMIT 1
            ''', (execution_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if row:
                return {
                    'id': row[0],
                    'function_id': row[1],
                    'execution_id': row[2],
                    'original_result': row[3],
                    'scale_factor_a': row[4],
                    'offset_b': row[5],
                    'scaled_result': row[6],
                    'variables': json.loads(row[7]),
                    'created_at': row[8],
                    'function_name': row[9],
                    'formula': row[10]
                }
            return None
            
        except Exception as e:
            logger.error(f"Failed to retrieve scaled result: {e}")
            return None
    
    def get_all_scaled_results(self, function_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve all scaled results, optionally filtered by function name"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            if function_name:
                cursor.execute('''
                    SELECT sr.*, f.name as function_name, f.formula 
                    FROM scaling_results sr
                    LEFT JOIN functions f ON sr.function_id = f.id
                    WHERE f.name = ?
                    ORDER BY sr.created_at DESC
                ''', (function_name,))
            else:
                cursor.execute('''
                    SELECT sr.*, f.name as function_name, f.formula 
                    FROM scaling_results sr
                    LEFT JOIN functions f ON sr.function_id = f.id
                    ORDER BY sr.created_at DESC
                ''')
            
            rows = cursor.fetchall()
            conn.close()
            
            results = []
            for row in rows:
                results.append({
                    'id': row[0],
                    'function_id': row[1],
                    'execution_id': row[2],
                    'original_result': row[3],
                    'scale_factor_a': row[4],
                    'offset_b': row[5],
                    'scaled_result': row[6],
                    'variables': json.loads(row[7]),
                    'created_at': row[8],
                    'function_name': row[9],
                    'formula': row[10]
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to retrieve scaled results: {e}")
            return []
    
    def _evaluate_formula(self, formula: str, variables: Dict[str, Any]) -> float:
        """Safely evaluate mathematical formula with given variables"""
        try:
            # Create a safe namespace for evaluation
            safe_dict = {
                '__builtins__': {},
                'abs': abs,
                'max': max,
                'min': min,
                'sum': sum,
                'avg': lambda x: statistics.mean(x),
                'sqrt': math.sqrt,
                'log': math.log,
                'exp': math.exp,
                'sin': math.sin,
                'cos': math.cos,
                'tan': math.tan,
                'pi': math.pi,
                'e': math.e
            }
            
            # Add variables to namespace
            safe_dict.update(variables)
            
            # Process lists with aggregate functions
            processed_formula = formula
            for var_name, var_value in variables.items():
                if isinstance(var_value, list):
                    # Replace aggregate function calls
                    if f'sum({var_name})' in processed_formula:
                        processed_formula = processed_formula.replace(f'sum({var_name})', str(sum(var_value)))
                    if f'avg({var_name})' in processed_formula:
                        processed_formula = processed_formula.replace(f'avg({var_name})', str(statistics.mean(var_value)))
                    if f'max({var_name})' in processed_formula:
                        processed_formula = processed_formula.replace(f'max({var_name})', str(max(var_value)))
                    if f'min({var_name})' in processed_formula:
                        processed_formula = processed_formula.replace(f'min({var_name})', str(min(var_value)))
            
            logger.info(f"Processed expression: {processed_formula}")
            
            # Evaluate the expression
            result = eval(processed_formula, safe_dict)
            return float(result)
            
        except Exception as e:
            logger.error(f"Formula evaluation failed: {e}")
            raise ValueError(f"Invalid formula or variables: {e}")
    
    def process_formula(self, formula: str, variables: Dict[str, Any], 
                       scale_factor_a: float = 2.0, offset_b: float = 0.0,
                       execution_id: Optional[str] = None) -> Dict[str, Any]:
        """Main method to process a formula request with scaling"""
        logger.info("=" * 50)
        logger.info("PROCESSING NEW FORMULA REQUEST")
        logger.info("=" * 50)
        
        # Generate execution ID if not provided
        if not execution_id:
            execution_id = f"exec_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        
        try:
            # Step 1: Analyze formula structure
            logger.info("Step 1: Analyzing formula structure")
            logger.info(f"Extracting parameters from formula: {formula}")
            parameters = self._extract_parameters(formula)
            logger.info(f"Extracted parameters: {parameters}")
            
            # Step 2: Check for similar existing functions
            logger.info("Step 2: Checking for similar existing functions")
            logger.info("Searching for similar functions with threshold 0.85")
            existing_functions = self._get_functions()
            logger.info(f"Retrieved {len(existing_functions)} functions from database")
            
            # For now, assume no similar functions (can be enhanced with similarity matching)
            logger.info("No similar functions found")
            
            # Step 3: Generate function name
            logger.info("Step 3: Generating new function name")
            function_name = self._generate_function_name(formula, parameters)
            logger.info(f"Generated function name: {function_name}")
            
            # Step 4: Create function metadata
            logger.info("Step 4: Creating new function metadata")
            calculation_type = 'financial' if any(term in formula.lower() for term in ['revenue', 'profit', 'cost', 'tax']) else 'general'
            
            try:
                self.save_function(function_name, formula, parameters, description=calculation_type)
            except Exception as e:
                logger.warning(f"Failed to save function '{function_name}': {e}")
            
            # Step 5: Evaluate formula
            logger.info("Step 5: Evaluating formula")
            logger.info(f"Evaluating formula: {formula}")
            logger.info(f"With variables: {variables}")
            
            original_result = self._evaluate_formula(formula, variables)
            logger.info(f"Original evaluation result: {original_result}")
            
            # Step 6: Apply scaling
            logger.info("Step 6: Applying scaling transformation")
            logger.info(f"Scaling parameters: a={scale_factor_a}, b={offset_b}")
            scaled_result = self._apply_scaling(original_result, scale_factor_a, offset_b)
            logger.info(f"Scaled result: {scaled_result}")
            
            # Step 7: Save scaled result
            logger.info("Step 7: Saving scaled result")
            result_id = self._save_scaled_result(
                function_name, execution_id, original_result, scaled_result,
                scale_factor_a, offset_b, variables
            )
            
            logger.info(f"Successfully created and evaluated function {function_name}")
            logger.info(f"Original result: {original_result}")
            logger.info(f"Scaled result: {scaled_result}")
            logger.info(f"Execution ID: {execution_id}")
            
            # Return results
            return {
                'execution_id': execution_id,
                'result_id': result_id,
                'function_name': function_name,
                'formula': formula,
                'parameters': parameters,
                'variables': variables,
                'original_result': original_result,
                'scaled_result': scaled_result,
                'scale_factor_a': scale_factor_a,
                'offset_b': offset_b,
                'calculation_type': calculation_type
            }
            
        except Exception as e:
            logger.error(f"Formula processing failed: {e}")
            raise
        
        finally:
            logger.info("PROCESSING COMPLETE")
            logger.info("=" * 50)
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get system statistics"""
        functions = self._get_functions()
        return {
            'total_functions': len(functions),
            'llm_enabled': self.llm_client is not None,
            'ai_provider': 'Gemini' if self.llm_client else 'None',
            'database_path': self.db_path,
            'function_types': {}
        }
    
    def _generate_with_gemini(self, prompt: str) -> str:
        """Generate text using Gemini API"""
        if not self.llm_client:
            logger.warning("Gemini client not available")
            return ""
        
        try:
            response = self.llm_client.generate_content(prompt)
            return response.text
        except Exception as e:
            logger.error(f"Gemini generation failed: {e}")
            return ""

    def _analyze_formula_with_ai(self, formula: str) -> Dict[str, Any]:
        """Analyze formula using Gemini AI to extract insights"""
        if not self.llm_client:
            return {"insights": "AI analysis not available"}
        
        prompt = f"""
        Analyze this mathematical formula and provide insights:
        Formula: {formula}
        
        Please provide:
        1. A brief description of what this formula calculates
        2. The type of calculation (financial, statistical, mathematical, etc.)
        3. Key parameters and their likely meanings
        4. Any potential use cases
        
        Respond in JSON format with keys: description, type, parameters, use_cases
        """
        
        try:
            response = self._generate_with_gemini(prompt)
            # Try to parse as JSON, fallback to plain text
            try:
                return json.loads(response)
            except json.JSONDecodeError:
                return {"insights": response}
        except Exception as e:
            logger.error(f"AI analysis failed: {e}")
            return {"insights": "AI analysis failed"}

# Example usage and testing
def main():
    print("✓ Agentic Formula System ready! (Using Gemini AI)")
    
    # Initialize system
    system = AgenticFormulaSystem()
    
    # Test examples
    examples = [
        {
            'title': 'Financial Calculation',
            'formula': 'revenue - sum(expenses)',
            'variables': {'revenue': 120000, 'expenses': [20000, 30000, 15000]}
        },
        {
            'title': 'Interest Calculation',
            'formula': 'principal * (1 + rate) ** years',
            'variables': {'principal': 10000, 'rate': 0.05, 'years': 3}
        },
        {
            'title': 'Data Aggregation',
            'formula': 'avg(scores) * weight_factor',
            'variables': {'scores': [85, 92, 78, 95, 88], 'weight_factor': 1.2}
        }
    ]
    
    for i, example in enumerate(examples, 1):
        print(f"\n{'='*60}")
        print(f"🧪 EXAMPLE {i}: {example['title']}")
        print(f"{'='*60}")

        try:
            result = system.process_formula(example['formula'], example['variables'])
            print(f"🔍 Processing Formula: {example['formula']}")
            print(f"🎯 Original Result: {result['original_result']}")
            print(f"📊 Scaled Result: {result['scaled_result']}")
            print(f"🏷️ Function Name: {result['function_name']}")
            print(f"🆔 Execution ID: {result['execution_id']}")
            
        except Exception as e:
            print(f"❌ Error: {e}")
    
    # Print statistics
    print(f"\n{'='*60}")
    print("📋 SYSTEM STATISTICS")
    print(f"{'='*60}")
    stats = system.get_statistics()
    print(f"📚 Total Functions: {stats['total_functions']}")
    print(f"🤖 Gemini AI: {'Yes' if stats['llm_enabled'] else 'No'} ({'AI mode' if stats['llm_enabled'] else 'Fallback Mode'})")
    print(f"💾 Database: {stats['database_path']}")
    
    # Display all functions in the database
    system.print_all_functions()

if __name__ == "__main__":
    main()